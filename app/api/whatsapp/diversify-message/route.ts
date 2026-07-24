import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { createMessage } from "@/src/lib/turso/lead-messages-repository";
import { getLeadById } from "@/src/lib/turso/leads-repository";
import { diversifyBaseCopyWithReport } from "@/src/lib/whatsapp/copy-diversifier";
import { manualWhatsAppProvider } from "@/src/lib/whatsapp/provider";

const diversifyMessageSchema = z.object({
  baseCopy: z.string().trim().min(10).max(5000).optional(),
  city: z.string().trim().max(120).optional().default(""),
  copyBase: z.string().trim().min(10).max(5000).optional(),
  leadId: z.string().uuid(),
  mode: z.enum(["short_whatsapp", "balanced", "high_variation", "ultra_short", "same_strength"]).optional().default("short_whatsapp"),
  niche: z.string().trim().max(120).optional().default(""),
  variantSeed: z.coerce.number().int().min(0).max(100000).optional().default(1),
}).refine((data) => data.baseCopy || data.copyBase, {
  message: "Informe a copy base.",
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

  const parsed = diversifyMessageSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const { city, leadId, mode, niche, variantSeed } = parsed.data;
  const baseCopy = parsed.data.baseCopy ?? parsed.data.copyBase ?? "";
  const lead = await getLeadById(user.id, leadId);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  const diversification = diversifyBaseCopyWithReport({
    baseCopy,
    city,
    lead,
    mode,
    niche,
    variantSeed,
  });
  const message = diversification.message;
  const phone = lead.whatsapp || "";
  const waLink = phone
    ? manualWhatsAppProvider.createMessageLink({ phone, message })
    : null;

  const savedMessage = await createMessage(user.id, lead.id, {
    message,
    objective: JSON.stringify({
      city,
      diversificationScore: diversification.diversificationScore,
      diversified: true,
      finalLength: diversification.stats.finalLength,
      mode,
      niche,
      reductionPercent: diversification.stats.reductionPercent,
      source: "base_copy_diversification",
      transformationsApplied: diversification.transformationsApplied,
    }),
    tone: "base_copy_diversification",
  });

  return NextResponse.json({
    diversificationScore: diversification.diversificationScore,
    message,
    savedMessage,
    stats: diversification.stats,
    transformationsApplied: diversification.transformationsApplied,
    waLink,
  });
}
