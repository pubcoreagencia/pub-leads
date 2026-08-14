import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listWhatsappInstances } from "@/src/lib/turso/whatsapp-instances-repository";
import { sendEvolutionTextMessage } from "@/src/lib/whatsapp/evolution-client";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const body = await request.json();
    const { instanceId, phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json({ error: "Telefone e mensagem são obrigatórios." }, { status: 400 });
    }

    const instances = await listWhatsappInstances(user.id);
    // Usa a instância especificada ou a primeira conectada ('open')
    const activeInstance = instanceId
      ? instances.find((i) => i.id === instanceId && i.is_active)
      : instances.find((i) => i.status === "open" && i.is_active);

    if (!activeInstance) {
      return NextResponse.json({
        error: "Nenhum WhatsApp conectado. Conecte um número na aba Conexões WhatsApp primeiro.",
      }, { status: 400 });
    }

    const response = await sendEvolutionTextMessage(
      activeInstance.server_url,
      activeInstance.api_key,
      activeInstance.instance_name,
      phone,
      message,
    );

    return NextResponse.json({ success: true, response });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro ao enviar mensagem via WhatsApp nativo.",
    }, { status: 500 });
  }
}
