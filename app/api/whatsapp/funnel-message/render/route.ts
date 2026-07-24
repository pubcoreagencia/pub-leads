import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getTursoUnavailableMessage, hasTursoConfig } from "@/src/lib/turso/client";
import { getLeadById } from "@/src/lib/turso/leads-repository";
import { getMessageFunnel } from "@/src/lib/turso/message-funnels-repository";
import { renderFunnelMessage } from "@/src/lib/whatsapp/message-funnel";

const renderSchema = z.object({
  funnelId: z.string().trim().optional(),
  leadId: z.string().uuid(),
  stepId: z.string().trim(),
});

export async function POST(request: Request) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = renderSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const lead = await getLeadById(user.id, parsed.data.leadId);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  const funnel = await getMessageFunnel(user.id, parsed.data.funnelId);
  const step = funnel?.steps.find((item) => item.id === parsed.data.stepId);

  if (!funnel || !step) {
    return NextResponse.json({ error: "Passo do funil nao encontrado." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const message = renderFunnelMessage({
    context: { funnelName: funnel.name, operatorName: profile?.full_name ?? null },
    lead,
    template: step.template,
    user,
  });

  return NextResponse.json({ message });
}
