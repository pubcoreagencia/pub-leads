import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getLeadById } from "@/src/lib/turso/leads-repository";
import { getTursoUnavailableMessage, hasTursoConfig } from "@/src/lib/turso/client";
import { createLeadMessageEvent, listLeadMessageEvents } from "@/src/lib/turso/message-funnels-repository";

const eventSchema = z.object({
  event_type: z.enum([
    "copied",
    "opened_whatsapp",
    "marked_sent",
    "marked_replied",
    "skipped",
    "advanced_step",
    "note",
  ]),
  funnel_id: z.string().trim().optional().nullable(),
  message_content: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  step_id: z.string().trim().optional().nullable(),
  step_order: z.coerce.number().int().min(1).max(30).optional().nullable(),
});

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const { leadId } = await params;
  const events = await listLeadMessageEvents(userId, leadId);

  return NextResponse.json({ events });
}

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = eventSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Evento invalido." }, { status: 400 });
  }

  const { leadId } = await params;
  const lead = await getLeadById(userId, leadId);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  const event = await createLeadMessageEvent(userId, lead, parsed.data);

  return NextResponse.json({ event });
}
