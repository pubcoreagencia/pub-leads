import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { updateMessageWorkspaceMetadata } from "@/src/lib/turso/lead-messages-repository";
import { updateLeadStatus } from "@/src/lib/turso/leads-repository";

const workspaceEventSchema = z.object({
  action: z.enum(["opened", "copied", "contacted"]),
  leadId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
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
    return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  }

  const parsed = workspaceEventSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Evento de abordagem inválido." }, { status: 400 });
  }

  const { action, leadId, messageId } = parsed.data;
  const timestamp = new Date().toISOString();

  if (messageId) {
    await updateMessageWorkspaceMetadata(user.id, leadId, messageId, {
      [`${action}At`]: timestamp,
    });
  }

  if (action === "contacted") {
    const lead = await updateLeadStatus(user.id, leadId, "contacted");

    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true, timestamp });
}
