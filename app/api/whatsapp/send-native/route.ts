import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listWhatsappInstances,
  updateWhatsappInstance,
} from "@/src/lib/turso/whatsapp-instances-repository";
import {
  getEvolutionInstanceStatus,
  sendEvolutionTextMessage,
} from "@/src/lib/whatsapp/evolution-client";
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

    const instances = await listWhatsappInstances(user.id);
    if (instances.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma instância de WhatsApp cadastrada. Vá em Conexões e escaneie o QR Code." },
        { status: 422 },
      );
    }

    const { serverUrl, apiKey } = getEvolutionConfig();

    let instance = instanceId
      ? instances.find((i) => i.id === instanceId && i.status === "open")
      : instances.find((i) => i.status === "open");

    if (!instance) {
      const candidates = instanceId ? instances.filter((i) => i.id === instanceId) : instances;
      for (const candidate of candidates) {
        try {
          const liveStatus = await getEvolutionInstanceStatus(serverUrl, apiKey, candidate.instance_name);
          if (liveStatus.state === "open") {
            instance = { ...candidate, status: "open" };
            void updateWhatsappInstance(user.id, candidate.id, { status: "open" });
            break;
          }
        } catch {
          // Continua
        }
      }
    }

    if (!instance) {
      return NextResponse.json(
        { error: "Nenhum WhatsApp conectado no momento. Vá em Conexões e conecte um aparelho." },
        { status: 422 },
      );
    }

    const result = await sendEvolutionTextMessage(
      serverUrl,
      apiKey,
      instance.instance_name,
      phone,
      message,
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao enviar mensagem.";
    return NextResponse.json(
      {
        error: msg.includes("Timeout") || msg.includes("aborted")
          ? "O servidor WhatsApp demorou para responder. Use o botão 'Abrir no WhatsApp Web' para envio imediato."
          : msg,
      },
      { status: 500 },
    );
  }
}
