import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getLeadById } from "@/src/lib/turso/leads-repository";
import { getTursoUnavailableMessage, hasTursoConfig } from "@/src/lib/turso/client";
import { getMessageFunnel } from "@/src/lib/turso/message-funnels-repository";
import { diversifyFunnelStepMessage, renderFunnelMessage } from "@/src/lib/whatsapp/message-funnel";

const diversifySchema = z.object({
  funnelId: z.string().trim().optional(),
  leadId: z.string().uuid(),
  stepId: z.string().trim(),
  variantSeed: z.coerce.number().int().min(0).max(100000).optional().default(1),
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

  const parsed = diversifySchema.safeParse(await request.json());

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

  const renderedTemplate = diversifyFunnelStepMessage({
    lead,
    renderedMessage: step.template,
    step,
    variantSeed: parsed.data.variantSeed,
  });
  const message = renderFunnelMessage({
    context: { funnelName: funnel.name },
    lead,
    template: renderedTemplate,
    user,
  });

  return NextResponse.json({ message });
}
