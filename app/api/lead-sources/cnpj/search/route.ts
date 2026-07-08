import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { cnpjBaseHasData, cnpjBrasilProvider } from "@/src/lib/lead-sources/cnpj-brasil";
import type { CnpjLeadSearchParams, NormalizedLead } from "@/src/lib/lead-sources/types";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { findDuplicateLead } from "@/src/lib/turso/leads-repository";
import { createSearchLog } from "@/src/lib/turso/search-logs-repository";
import { canSearch } from "@/src/lib/usage/limits";

const cnpjSearchSchema = z.object({
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  query: z.string().trim().max(120).optional(),
  cnae: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(100),
  onlyWithPhone: z.boolean().optional().default(false),
});

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }

  return fallback;
}

async function registerSearchLog(
  userId: string,
  params: CnpjLeadSearchParams,
  resultCount: number,
  status: "success" | "failed",
  errorMessage?: string,
) {
  await createSearchLog(userId, {
    category: params.cnae ?? params.query ?? null,
    city: params.city,
    country: "Brasil",
    raw_params: {
      ...params,
      error: errorMessage,
    },
    query: params.query || params.cnae || `CNPJ em ${params.city}, ${params.state}`,
    result_count: resultCount,
    source: "cnpj_brasil",
    status,
    state: params.state,
  });
}

async function markSavedLeads(userId: string, results: NormalizedLead[]) {
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
          source_place_id: lead.sourcePlaceId,
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

  const parsed = cnpjSearchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros de busca invalidos." }, { status: 400 });
  }

  const params = parsed.data;

  try {
    if (!(await canSearch(user.id))) {
      throw new Error("Limite mensal de buscas do plano atingido.");
    }

    const results = await cnpjBrasilProvider.search(params);
    if (results.length === 0 && !(await cnpjBaseHasData())) {
      throw new Error(
        "Base CNPJ vazia no Turso. Baixe os ZIPs oficiais da Receita e rode npm run turso:setup antes de importar.",
      );
    }
    await registerSearchLog(user.id, params, results.length, "success");

    return NextResponse.json({
      results: await markSavedLeads(user.id, results),
    });
  } catch (error) {
    const message = getErrorMessage(error, "Erro ao buscar leads no CNPJ.");

    try {
      await registerSearchLog(user.id, params, 0, "failed", message);
    } catch {
      // Preserve the original provider error for the UI.
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
