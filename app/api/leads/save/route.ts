import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { createManyLeads, findDuplicateLead } from "@/src/lib/turso/leads-repository";
import type { LeadWriteInput } from "@/src/lib/turso/types";
import { getUsageSummary } from "@/src/lib/usage/limits";

const nullableStringSchema = z.string().nullable().optional();

const externalLeadSchema = z
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
    rating: z.number().nullable().optional(),
    raw: z.record(z.string(), z.unknown()).optional(),
    rawData: z.record(z.string(), z.unknown()).optional(),
    reviewsCount: z.number().int().nullable().optional(),
    source: z.enum(["openstreetmap", "cnpj_brasil", "google_places"]),
    sourcePlaceId: z.string().min(1).optional(),
    sourceUrl: nullableStringSchema,
    state: z.string().min(1),
    website: nullableStringSchema,
  })
  .refine((lead) => lead.externalId || lead.sourcePlaceId || lead.cnpj, {
    message: "Lead sem identificador externo.",
  });

const saveSchema = z.object({
  leads: z.array(externalLeadSchema).min(1).max(100),
});

type SaveLeadInput = z.infer<typeof externalLeadSchema>;

function getExternalId(lead: SaveLeadInput) {
  return lead.externalId ?? lead.sourcePlaceId ?? lead.cnpj ?? lead.name;
}

function getLeadKey(lead: SaveLeadInput) {
  return `${lead.source}:${getExternalId(lead)}`;
}

function toLeadInput(lead: SaveLeadInput): LeadWriteInput {
  const rawData = lead.rawData ?? lead.raw ?? {};

  return {
    address: lead.address ?? null,
    business_name: lead.businessName ?? null,
    category: lead.category,
    city: lead.city,
    cnae: lead.cnae ?? null,
    cnae_description: lead.cnaeDescription ?? null,
    cnpj: lead.cnpj ?? null,
    country: lead.country,
    email: lead.email ?? null,
    enrichment_source: lead.source === "cnpj_brasil" ? "cnpj_brasil" : null,
    fantasy_name: lead.fantasyName ?? null,
    latitude: lead.latitude ?? null,
    longitude: lead.longitude ?? null,
    name: lead.name,
    phone: lead.phone ?? null,
    phone_2: lead.phone2 ?? null,
    rating: lead.rating ?? null,
    raw_cnpj_data: lead.source === "cnpj_brasil" ? rawData : null,
    raw_data: rawData,
    reviews_count: lead.reviewsCount ?? null,
    source: lead.source,
    source_place_id: getExternalId(lead),
    source_url: lead.sourceUrl ?? null,
    state: lead.state,
    status: "new",
    website: lead.website ?? null,
  };
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

  const parsed = saveSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Leads invalidos." }, { status: 400 });
  }

  const uniqueLeads = Array.from(
    new Map(parsed.data.leads.map((lead) => [getLeadKey(lead), lead])).values(),
  );
  const externalIds = uniqueLeads.map(getExternalId);
  const preparedLeads = uniqueLeads.map((lead) => ({
    externalId: getExternalId(lead),
    input: toLeadInput(lead),
  }));
  const duplicateExternalIds: string[] = [];
  const leadsToInsert: LeadWriteInput[] = [];

  for (const lead of preparedLeads) {
    const duplicate = await findDuplicateLead(user.id, lead.input);

    if (duplicate) {
      duplicateExternalIds.push(lead.externalId);
      continue;
    }

    leadsToInsert.push(lead.input);
  }

  if (leadsToInsert.length === 0) {
    return NextResponse.json({
      savedExternalIds: [],
      skippedExternalIds: externalIds,
    });
  }

  const usage = await getUsageSummary(user.id);
  const leadLimit = usage.plan.limits.leadLimit;

  if (leadLimit !== null) {
    const remaining = leadLimit - usage.leadsUsed;

    if (leadsToInsert.length > remaining) {
      return NextResponse.json(
        {
          error: `Limite de leads do plano atingido. Restam ${Math.max(remaining, 0)} vagas.`,
        },
        { status: 403 },
      );
    }
  }

  const result = await createManyLeads(user.id, leadsToInsert);
  const savedExternalIds = result.created.map((lead) => lead.external_id).filter(Boolean);
  const skippedExternalIds = result.skipped.map((lead) => lead.external_id).filter(Boolean);

  return NextResponse.json({
    savedExternalIds,
    skippedExternalIds: [
      ...duplicateExternalIds,
      ...skippedExternalIds,
      ...externalIds.filter(
        (externalId) =>
          !savedExternalIds.includes(externalId) &&
          !skippedExternalIds.includes(externalId) &&
          !duplicateExternalIds.includes(externalId),
      ),
    ],
  });
}
