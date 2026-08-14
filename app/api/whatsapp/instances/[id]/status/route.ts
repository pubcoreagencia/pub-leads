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

    // 1. Checa status puro da conexão na Evolution API
    const statusData = await getEvolutionInstanceStatus(
      serverUrl,
      apiKey,
      instance.instance_name,
    );

    // Se estiver 'open', o WhatsApp foi conectado com sucesso!
    if (statusData.state === "open") {
      await updateWhatsappInstance(user.id, instance.id, {
        status: "open",
        qr_code: null,
      });
      return NextResponse.json({
        instance: { ...instance, status: "open", qr_code: null },
        qrcode: null,
      });
    }

    // Se não estiver 'open', a instância ainda está aguardando escaneamento
    let qr = instance.qr_code ? { base64: instance.qr_code } : null;

    // Se o QR expirou ou foi solicitado um novo explicitamente via refresh
    if (refreshQr || !qr) {
      try {
        const newQr = await getEvolutionQRCode(serverUrl, apiKey, instance.instance_name);
        if (newQr.base64) {
          qr = { base64: newQr.base64 };
          await updateWhatsappInstance(user.id, instance.id, {
            status: "qrcode",
            qr_code: newQr.base64,
          });
        }
      } catch {
        // Mantém o estado atual se falhar
      }
    }

    return NextResponse.json({
      instance: { ...instance, status: "qrcode", qr_code: qr?.base64 ?? null },
      qrcode: qr,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro ao checar status da instância.",
    }, { status: 500 });
  }
}
