import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getTursoUnavailableMessage, hasTursoConfig } from "@/src/lib/turso/client";
import {
  getOrCreateLeadFunnelState,
  listLeadMessageEvents,
  updateLeadFunnelState,
} from "@/src/lib/turso/message-funnels-repository";

const updateSchema = z.object({
  current_step_id: z.string().trim().optional().nullable(),
  current_step_order: z.coerce.number().int().min(1).max(30).optional(),
  status: z
    .enum(["not_started", "contacted", "replied", "explaining", "follow_up", "converted", "lost", "paused"])
    .optional(),
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
  const state = await getOrCreateLeadFunnelState(userId, leadId);

  if (!state) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  const events = await listLeadMessageEvents(userId, leadId);

  return NextResponse.json({ events, state });
}

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const { leadId } = await params;
  const state = await updateLeadFunnelState(userId, leadId, parsed.data);

  if (!state) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ state });
}
