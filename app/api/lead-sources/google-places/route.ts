import { NextResponse } from "next/server";
import { z } from "zod";

import { leadCategories, type LeadCategoryId } from "@/config/lead-categories";
import { createClient } from "@/lib/supabase/server";
import { googlePlacesProvider, hasGooglePlacesConfig } from "@/src/lib/lead-sources/google-places";
import type { GooglePlacesSearchParams, NormalizedLead } from "@/src/lib/lead-sources/types";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { findDuplicateLead } from "@/src/lib/turso/leads-repository";
import { createSearchLog } from "@/src/lib/turso/search-logs-repository";
import { canSearch } from "@/src/lib/usage/limits";

const categoryIds = leadCategories.map((category) => category.id);

const searchSchema = z.object({
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  country: z.string().trim().min(2),
  category: z
    .string()
    .refine((value) => categoryIds.includes(value as LeadCategoryId), "Categoria invalida."),
  onlyWithPhone: z.boolean().optional().default(false),
  onlyWithWebsite: z.boolean().optional().default(false),
  radiusKm: z.coerce.number().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(60),
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
  params: GooglePlacesSearchParams,
  resultCount: number,
  status: "success" | "failed",
  errorMessage?: string,
) {
  await createSearchLog(userId, {
    category: params.category,
    city: params.city,
    country: params.country,
    raw_params: {
      ...params,
      error: errorMessage,
    },
    query: `${params.category} em ${params.city}, ${params.state}, ${params.country}`,
    result_count: resultCount,
    source: "google_places",
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

  const parsed = searchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros de busca invalidos." }, { status: 400 });
  }

  const params = parsed.data as GooglePlacesSearchParams;

  try {
    if (!hasGooglePlacesConfig()) {
      throw new Error(
        "Google Places indisponivel. Configure GOOGLE_PLACES_API_KEY ou GOOGLE_MAPS_API_KEY para habilitar essa fonte.",
      );
    }

    if (!(await canSearch(user.id, user.email))) {
      throw new Error("Limite mensal de buscas do plano atingido.");
    }

    const results = await googlePlacesProvider.search(params);
    await registerSearchLog(user.id, params, results.length, "success");

    return NextResponse.json({
      results: await markSavedLeads(user.id, results),
    });
  } catch (error) {
    const message = getErrorMessage(error, "Erro ao buscar leads no Google Places.");

    try {
      await registerSearchLog(user.id, params, 0, "failed", message);
    } catch {
      // Preserve the original provider error for the UI.
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
