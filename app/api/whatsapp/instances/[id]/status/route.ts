import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listWhatsappInstances,
  updateWhatsappInstance,
} from "@/src/lib/turso/whatsapp-instances-repository";
import {
  getEvolutionInstanceStatus,
  getEvolutionQRCode,
} from "@/src/lib/whatsapp/evolution-client";
import { getEvolutionConfig } from "@/src/lib/whatsapp/config";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const instances = await listWhatsappInstances(user.id);
  const instance = instances.find((i) => i.id === id);

  if (!instance) {
    return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });
  }

  try {
    // Usa credenciais globais (env vars) em vez das gravadas no banco
    const { serverUrl, apiKey } = getEvolutionConfig();

    // 1. Checa status da conexão na Evolution API
    const statusData = await getEvolutionInstanceStatus(
      serverUrl,
      apiKey,
      instance.instance_name,
    );

    let status = instance.status;
    let qr = null;

    if (statusData.state === "open") {
      status = "open";
    } else {
      // Se não estiver aberta, tenta pegar o QR code
      try {
        qr = await getEvolutionQRCode(serverUrl, apiKey, instance.instance_name);
        if (qr.base64 || qr.code) {
          status = "qrcode";
        }
      } catch {
        status = "close";
      }
    }

    // Atualiza estado no banco Turso
    await updateWhatsappInstance(user.id, instance.id, {
      status,
      qr_code: qr?.base64 ?? null,
    });

    return NextResponse.json({
      instance: { ...instance, status, qr_code: qr?.base64 ?? null },
      qrcode: qr,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro ao checar status da instância.",
    }, { status: 500 });
  }
}
