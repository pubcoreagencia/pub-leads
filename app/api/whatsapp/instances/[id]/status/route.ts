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
  request: Request,
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

  const { searchParams } = new URL(request.url);
  const refreshQr = searchParams.get("refresh") === "true";

  try {
    const { serverUrl, apiKey } = getEvolutionConfig();

    // 1. Checa status puro da conexão sem disparar reconexão
    const statusData = await getEvolutionInstanceStatus(
      serverUrl,
      apiKey,
      instance.instance_name,
    );

    let status = instance.status;
    let qr = null;

    if (statusData.state === "open") {
      status = "open";
      // Se conectou, limpa o QR code do banco
      await updateWhatsappInstance(user.id, instance.id, {
        status: "open",
        qr_code: null,
      });
      return NextResponse.json({
        instance: { ...instance, status: "open", qr_code: null },
        qrcode: null,
      });
    }

    if (statusData.state === "connecting") {
      status = "connecting";
      await updateWhatsappInstance(user.id, instance.id, { status: "connecting" });
      return NextResponse.json({
        instance: { ...instance, status: "connecting" },
        qrcode: null,
      });
    }

    // 2. Só tenta obter novo QR Code se for explicitamente solicitado via refresh=true ou se a instância não tiver nenhum QR
    if (refreshQr || (!instance.qr_code && status === "close")) {
      try {
        qr = await getEvolutionQRCode(serverUrl, apiKey, instance.instance_name);
        if (qr.base64 || qr.code) {
          status = "qrcode";
          await updateWhatsappInstance(user.id, instance.id, {
            status: "qrcode",
            qr_code: qr.base64 ?? null,
          });
        }
      } catch {
        status = "close";
      }
    }

    return NextResponse.json({
      instance: { ...instance, status, qr_code: qr?.base64 ?? instance.qr_code },
      qrcode: qr ?? (instance.qr_code ? { base64: instance.qr_code } : null),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro ao checar status da instância.",
    }, { status: 500 });
  }
}
