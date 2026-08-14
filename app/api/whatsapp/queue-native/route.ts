import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enqueueWhatsappMessage, getLastScheduledTime } from "@/src/lib/turso/whatsapp-queue-repository";
import { listWhatsappInstances } from "@/src/lib/turso/whatsapp-instances-repository";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const { leadId, instanceId, message, funnelId, stepId } = await request.json();

    if (!leadId || !message) {
      return NextResponse.json({ error: "Lead ID e mensagem são obrigatórios." }, { status: 400 });
    }

    const instances = await listWhatsappInstances(user.id);
    let targetInstanceId = instanceId;

    if (!targetInstanceId) {
      const openInstance = instances.find((i) => i.status === "open");
      if (!openInstance) {
        return NextResponse.json({ error: "Nenhum WhatsApp conectado." }, { status: 422 });
      }
      targetInstanceId = openInstance.id;
    }

    // Calcular o delay dinâmico (Fila com Cadência Humana)
    // De 30s a 160s após a última mensagem agendada
    const lastTime = await getLastScheduledTime(user.id);
    const minDelaySecs = 30;
    const maxDelaySecs = 160;
    const randomDelayMs = Math.floor(Math.random() * (maxDelaySecs - minDelaySecs + 1) + minDelaySecs) * 1000;
    
    const scheduledAt = new Date(lastTime.getTime() + randomDelayMs);

    await enqueueWhatsappMessage({
      user_id: user.id,
      lead_id: leadId,
      instance_id: targetInstanceId,
      message_content: message,
      funnel_id: funnelId || "default",
      step_id: stepId || "default",
      scheduled_at: scheduledAt.toISOString(),
    });

    return NextResponse.json({ success: true, scheduled_at: scheduledAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao enfileirar mensagem." }, { status: 500 });
  }
}
