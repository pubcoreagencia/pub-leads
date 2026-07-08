import { NextResponse } from "next/server";
import { z } from "zod";

import { messageObjectives, messageTones } from "@/config/whatsapp";
import type { MessageObjective, MessageTone } from "@/config/whatsapp";
import { createClient } from "@/lib/supabase/server";
import { generateLeadMessage } from "@/src/lib/ai/openai";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { createMessage } from "@/src/lib/turso/lead-messages-repository";
import { getLeadById } from "@/src/lib/turso/leads-repository";
import { manualWhatsAppProvider } from "@/src/lib/whatsapp/provider";

const toneIds = messageTones.map((tone) => tone.id);
const objectiveIds = messageObjectives.map((objective) => objective.id);

const leadMessageSchema = z.object({
  leadId: z.string().uuid(),
  userCompany: z.string().trim().max(120).optional().default(""),
  tone: z.string().refine((value) => toneIds.includes(value as (typeof toneIds)[number])),
  objective: z
    .string()
    .refine((value) => objectiveIds.includes(value as (typeof objectiveIds)[number])),
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

  const parsed = leadMessageSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const { leadId, objective, tone, userCompany } = parsed.data;
  const selectedTone = tone as MessageTone;
  const selectedObjective = objective as MessageObjective;
  const lead = await getLeadById(user.id, leadId);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  const message = await generateLeadMessage(lead, userCompany, selectedTone, selectedObjective);
  const phone = lead.whatsapp || lead.phone || "";
  const waLink = phone
    ? manualWhatsAppProvider.createMessageLink({ phone, message })
    : null;

  const savedMessage = await createMessage(user.id, lead.id, {
    message,
    objective: selectedObjective,
    tone: selectedTone,
  });

  return NextResponse.json({
    message,
    savedMessage,
    waLink,
  });
}
