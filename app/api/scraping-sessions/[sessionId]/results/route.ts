import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { NormalizedLead } from "@/src/lib/lead-sources/types";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import {
  getScrapingSessionWithResults,
  updateScrapingSessionResultLeads,
  updateScrapingSessionResultSelection,
  upsertScrapingSessionResults,
} from "@/src/lib/turso/scraping-sessions-repository";

const paramsSchema = z.object({
  sessionId: z.string().uuid(),
});

const nullableStringSchema = z.string().nullable().optional();
const qualificationSchema = z.record(z.string(), z.unknown()).optional();

const leadSchema = z
  .object({
    address: nullableStringSchema,
    businessName: nullableStringSchema,
    category: z.string().min(1),
    city: z.string().min(1),
    cnae: nullableStringSchema,
    cnaeDescription: nullableStringSchema,
    cnpj: nullableStringSchema,
    country: z.string().min(1),
    email: nullableStringSchema,
    externalId: z.string().min(1).optional(),
    fantasyName: nullableStringSchema,
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    name: z.string().min(1),
    phone: nullableStringSchema,
    phone2: nullableStringSchema,
    qualification: qualificationSchema,
    rating: z.number().nullable().optional(),
    raw: z.record(z.string(), z.unknown()).optional(),
    rawData: z.record(z.string(), z.unknown()).optional(),
    reviewsCount: z.number().int().nullable().optional(),
    saved: z.boolean().optional(),
    selected: z.boolean().optional(),
    sessionResultId: z.string().uuid().optional(),
    source: z.enum(["openstreetmap", "cnpj_brasil", "google_places"]),
    sourcePlaceId: z.string().min(1).optional(),
    sourceUrl: nullableStringSchema,
    state: z.string().min(1),
    website: nullableStringSchema,
  })
  .passthrough();

const postSchema = z.object({
  leads: z.array(leadSchema).min(1).max(1000),
});

const patchSchema = z.object({
  leads: z.array(leadSchema).max(1000).optional(),
  resultIds: z.array(z.string().uuid()).max(1000).optional(),
  selected: z.boolean().optional(),
});

type ParsedLead = z.infer<typeof leadSchema>;

function normalizeLead(lead: ParsedLead): NormalizedLead & {
  externalId?: string;
  saved?: boolean;
  selected?: boolean;
  sessionResultId?: string;
  whatsapp?: string | null;
} {
  return {
    address: lead.address ?? null,
    businessName: lead.businessName ?? null,
    category: lead.category,
    city: lead.city,
    cnae: lead.cnae ?? null,
    cnaeDescription: lead.cnaeDescription ?? null,
    cnpj: lead.cnpj ?? null,
    country: lead.country,
    email: lead.email ?? null,
    externalId: lead.externalId,
    fantasyName: lead.fantasyName ?? null,
    latitude: lead.latitude ?? null,
    longitude: lead.longitude ?? null,
    name: lead.name,
    phone: lead.phone ?? null,
    phone2: lead.phone2 ?? null,
    qualification: lead.qualification as NormalizedLead["qualification"],
    rawData: lead.rawData ?? lead.raw ?? {},
    rating: lead.rating ?? null,
    reviewsCount: lead.reviewsCount ?? null,
    saved: lead.saved,
    selected: lead.selected,
    sessionResultId: lead.sessionResultId,
    source: lead.source,
    sourcePlaceId: lead.sourcePlaceId ?? lead.externalId ?? lead.cnpj ?? lead.name,
    sourceUrl: lead.sourceUrl ?? null,
    state: lead.state,
    website: lead.website ?? null,
    whatsapp: typeof lead.whatsapp === "string" ? lead.whatsapp : null,
  };
}

async function getUserId() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const [parsedParams, parsedBody] = await Promise.all([
    paramsSchema.safeParseAsync(await context.params),
    postSchema.safeParseAsync(await request.json()),
  ]);

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Resultados invalidos." }, { status: 400 });
  }

  await upsertScrapingSessionResults(
    userId,
    parsedParams.data.sessionId,
    parsedBody.data.leads.map(normalizeLead),
  );
  const payload = await getScrapingSessionWithResults(userId, parsedParams.data.sessionId);

  if (!payload) {
    return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
  }

  return NextResponse.json(payload);
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const [parsedParams, parsedBody] = await Promise.all([
    paramsSchema.safeParseAsync(await context.params),
    patchSchema.safeParseAsync(await request.json()),
  ]);

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Atualizacao invalida." }, { status: 400 });
  }

  if (parsedBody.data.leads) {
    const payload = await updateScrapingSessionResultLeads(
      userId,
      parsedParams.data.sessionId,
      parsedBody.data.leads.map(normalizeLead),
    );

    if (!payload) {
      return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
    }

    return NextResponse.json(payload);
  }

  if (parsedBody.data.resultIds && typeof parsedBody.data.selected === "boolean") {
    const payload = await updateScrapingSessionResultSelection(
      userId,
      parsedParams.data.sessionId,
      parsedBody.data.resultIds,
      parsedBody.data.selected,
    );

    if (!payload) {
      return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
    }

    return NextResponse.json(payload);
  }

  const payload = await getScrapingSessionWithResults(userId, parsedParams.data.sessionId);

  if (!payload) {
    return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
  }

  return NextResponse.json(payload);
}
