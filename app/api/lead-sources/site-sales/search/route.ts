import { NextResponse } from "next/server";
import { z } from "zod";

import { leadCategories, type LeadCategoryId } from "@/config/lead-categories";
import { createClient } from "@/lib/supabase/server";
import { cnpjBaseHasData, cnpjBrasilProvider } from "@/src/lib/lead-sources/cnpj-brasil";
import { overpassProvider } from "@/src/lib/lead-sources/overpass";
import type { ExternalLead, NormalizedLead } from "@/src/lib/lead-sources/types";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { findDuplicateLead } from "@/src/lib/turso/leads-repository";
import { createSearchLog } from "@/src/lib/turso/search-logs-repository";
import { canSearch } from "@/src/lib/usage/limits";

const categoryIds = leadCategories.map((category) => category.id);

const siteSalesSearchSchema = z.object({
  category: z
    .string()
    .refine((value) => categoryIds.includes(value as LeadCategoryId), "Categoria invalida."),
  city: z.string().trim().min(2),
  country: z.string().trim().min(2),
  limit: z.coerce.number().int().min(1).max(100),
  onlyWithPhone: z.boolean().optional().default(true),
  onlyWithoutWebsite: z.boolean().optional().default(true),
  radiusKm: z.coerce.number().min(1).max(50),
  state: z.string().trim().min(2),
});

type SiteSalesParams = z.infer<typeof siteSalesSearchSchema> & {
  category: LeadCategoryId;
};

type SearchResultLead = ExternalLead | NormalizedLead;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }

  return fallback;
}

function onlyDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function getExternalId(lead: SearchResultLead) {
  return "externalId" in lead ? lead.externalId : lead.sourcePlaceId;
}

function getPrimaryPhone(lead: SearchResultLead) {
  return onlyDigits(lead.phone) || onlyDigits(lead.phone2);
}

function hasKnownWebsite(lead: SearchResultLead) {
  return Boolean(lead.website?.trim());
}

function matchesSiteSalesFilters(lead: SearchResultLead, params: SiteSalesParams) {
  if (params.onlyWithPhone && !getPrimaryPhone(lead)) {
    return false;
  }

  if (params.onlyWithoutWebsite && hasKnownWebsite(lead)) {
    return false;
  }

  return true;
}

function dedupeResults(results: SearchResultLead[]) {
  const seen = new Set<string>();

  return results.filter((lead) => {
    const phone = getPrimaryPhone(lead);
    const cnpj = onlyDigits(lead.cnpj);
    const key = phone || cnpj || `${lead.source}:${getExternalId(lead)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function rankLead(lead: SearchResultLead) {
  let score = 0;

  if (lead.phone) {
    score += 4;
  }

  if (lead.phone2) {
    score += 2;
  }

  if (lead.source === "cnpj_brasil") {
    score += 2;
  }

  if (lead.address) {
    score += 1;
  }

  if (lead.cnaeDescription) {
    score += 1;
  }

  return score;
}

async function registerSearchLog(
  userId: string,
  params: SiteSalesParams,
  resultCount: number,
  status: "success" | "failed",
  warnings: string[],
  errorMessage?: string,
) {
  await createSearchLog(userId, {
    category: params.category,
    city: params.city,
    country: params.country,
    raw_params: {
      ...params,
      error: errorMessage,
      mode: "site_sales",
      sources: ["cnpj_brasil", "openstreetmap"],
      warnings,
    },
    query: `Venda de sites: ${params.category} em ${params.city}, ${params.state}`,
    result_count: resultCount,
    source: "cnpj_brasil",
    status,
    state: params.state,
  });
}

async function markSavedLeads(userId: string, results: SearchResultLead[]) {
  if (results.length === 0) {
    return [];
  }

  return Promise.all(
    results.map(async (lead) => ({
      ...lead,
      saved: Boolean(
        await findDuplicateLead(userId, {
          cnpj: lead.cnpj,
          phone: lead.phone,
          phone_2: lead.phone2,
          source: lead.source,
          source_place_id: getExternalId(lead),
        }),
      ),
    })),
  );
}

export async function POST(request: Request) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = siteSalesSearchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros de busca invalidos." }, { status: 400 });
  }

  const params = parsed.data as SiteSalesParams;
  const category = leadCategories.find((item) => item.id === params.category);
  const warnings: string[] = [];
  const failures: string[] = [];

  try {
    if (!(await canSearch(user.id))) {
      throw new Error("Limite mensal de buscas do plano atingido.");
    }

    let cnpjResults: SearchResultLead[] = [];
    let osmResults: SearchResultLead[] = [];

    try {
      cnpjResults = await cnpjBrasilProvider.search({
        city: params.city,
        limit: params.limit,
        onlyWithPhone: params.onlyWithPhone,
        query: category?.label ?? params.category,
        state: params.state,
      });

      if (cnpjResults.length === 0 && !(await cnpjBaseHasData())) {
        warnings.push("Base CNPJ vazia no Turso: importe os arquivos oficiais da Receita para aumentar o volume.");
      }
    } catch (error) {
      failures.push(`CNPJ Brasil: ${getErrorMessage(error, "erro ao consultar CNPJ")}`);
    }

    try {
      osmResults = await overpassProvider.search({
        category: params.category,
        city: params.city,
        country: params.country,
        limit: params.limit,
        radiusKm: params.radiusKm,
        state: params.state,
      });
    } catch (error) {
      failures.push(`OpenStreetMap: ${getErrorMessage(error, "erro ao consultar OSM")}`);
    }

    const results = dedupeResults([...cnpjResults, ...osmResults])
      .filter((lead) => matchesSiteSalesFilters(lead, params))
      .sort((left, right) => rankLead(right) - rankLead(left))
      .slice(0, params.limit);

    if (results.length === 0 && failures.length > 0 && warnings.length === 0) {
      throw new Error(failures.join(" | "));
    }

    await registerSearchLog(user.id, params, results.length, "success", [
      ...warnings,
      ...failures,
    ]);

    return NextResponse.json({
      results: await markSavedLeads(user.id, results),
      warnings: [...warnings, ...failures],
    });
  } catch (error) {
    const message = getErrorMessage(error, "Erro ao buscar leads para venda de sites.");

    try {
      await registerSearchLog(user.id, params, 0, "failed", warnings, message);
    } catch {
      // Preserve the original provider error for the UI.
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
