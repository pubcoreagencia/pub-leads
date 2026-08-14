import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listWhatsappInstances } from "@/src/lib/turso/whatsapp-instances-repository";
import { sendEvolutionTextMessage } from "@/src/lib/whatsapp/evolution-client";
import { getEvolutionConfig } from "@/src/lib/whatsapp/config";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const body = await request.json();
    const { instanceId, phone, message } = body as {
      instanceId?: string;
      phone: string;
      message: string;
    };

    if (!phone || !message) {
      return NextResponse.json({ error: "Telefone e mensagem são obrigatórios." }, { status: 400 });
    }

    // Carrega instâncias do usuário
    const instances = await listWhatsappInstances(user.id);

    // Seleciona a instância: usa instanceId se fornecido, caso contrário pega a primeira conectada
    const instance = instanceId
      ? instances.find((i) => i.id === instanceId && i.status === "open")
      : instances.find((i) => i.status === "open");

    if (!instance) {
      return NextResponse.json(
        { error: "Nenhuma instância de WhatsApp conectada. Vá em Conexões e escaneie o QR Code." },
        { status: 422 },
      );
    }

    // Usa credenciais globais (env vars) em vez das gravadas no banco
    const { serverUrl, apiKey } = getEvolutionConfig();

    const result = await sendEvolutionTextMessage(
      serverUrl,
      apiKey,
      instance.instance_name,
      phone,
      message,
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar mensagem." },
      { status: 500 },
    );
  }
}
