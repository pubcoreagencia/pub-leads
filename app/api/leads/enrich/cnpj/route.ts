import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { cnpjBrasilProvider } from "@/src/lib/lead-sources/cnpj-brasil";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { getLeadById, updateLead } from "@/src/lib/turso/leads-repository";

const enrichSchema = z.object({
  leadId: z.string().uuid(),
});

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

  const parsed = enrichSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const lead = await getLeadById(user.id, parsed.data.leadId);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  const match = await cnpjBrasilProvider.enrichLead?.(lead);

  if (!match || match.confidence < 0.65) {
    return NextResponse.json({
      matched: false,
      message: "Nao encontrei um CNPJ com confianca suficiente para enriquecer este lead.",
    });
  }

  const matchedLead = match.lead;
  const updatedLead = await updateLead(user.id, lead.id, {
    address: lead.address ?? matchedLead.address,
    business_name: matchedLead.businessName,
    category: lead.category ?? matchedLead.category,
    city: lead.city ?? matchedLead.city,
    cnae: matchedLead.cnae,
    cnae_description: matchedLead.cnaeDescription,
    cnpj: matchedLead.cnpj,
    email: lead.email ?? matchedLead.email,
    enrichment_confidence: match.confidence,
    enrichment_source: "cnpj_brasil",
    fantasy_name: matchedLead.fantasyName,
    phone: lead.phone ?? matchedLead.phone,
    phone_2: lead.phone_2 ?? matchedLead.phone2,
    raw_cnpj_data: matchedLead.rawData,
    raw_data: {
      ...(lead.metadata ?? {}),
      cnpjEnrichment: {
        confidence: match.confidence,
        reasons: match.reasons,
        sourcePlaceId: matchedLead.sourcePlaceId,
      },
    },
    state: lead.state ?? matchedLead.state,
    website: lead.website ?? matchedLead.website,
  });

  if (!updatedLead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    confidence: match.confidence,
    lead: updatedLead,
    matched: true,
    reasons: match.reasons,
  });
}
