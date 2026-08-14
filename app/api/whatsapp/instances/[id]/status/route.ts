import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listWhatsappInstances,
  updateWhatsappInstance,
} from "@/src/lib/turso/whatsapp-instances-repository";
import {
  createEvolutionInstance,
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
    const { serverUrl, apiKey } = getEvolutionConfig();

    // 1. Checa status da conexão na Evolution API
    const statusData = await getEvolutionInstanceStatus(
      serverUrl,
      apiKey,
      instance.instance_name,
    );

    // Se estiver 'open', o WhatsApp conectou!
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

    // Se estiver 'connecting', aguarda e não tenta recriar
    if (statusData.state === "connecting") {
      await updateWhatsappInstance(user.id, instance.id, {
        status: "connecting",
      });
      return NextResponse.json({
        instance: { ...instance, status: "connecting" },
        qrcode: instance.qr_code ? { base64: instance.qr_code } : null,
      });
    }

    // 2. Se não estiver 'open' nem 'connecting', busca o QR Code fresco da Evolution API
    let qr = null;
    try {
      const liveQr = await getEvolutionQRCode(serverUrl, apiKey, instance.instance_name);
      if (liveQr.base64) {
        qr = liveQr;
        await updateWhatsappInstance(user.id, instance.id, {
          status: "qrcode",
          qr_code: liveQr.base64,
        });
      }
    } catch {
      // Se a instância não existir mais na Evolution API, recria automaticamente
      try {
        const createResult = await createEvolutionInstance(serverUrl, apiKey, instance.instance_name);
        if (createResult.qrcode?.base64) {
          qr = createResult.qrcode;
          await updateWhatsappInstance(user.id, instance.id, {
            status: "qrcode",
            qr_code: createResult.qrcode.base64,
          });
        }
      } catch {
        qr = instance.qr_code ? { base64: instance.qr_code } : null;
      }
    }

    return NextResponse.json({
      instance: { ...instance, status: "qrcode", qr_code: qr?.base64 ?? instance.qr_code },
      qrcode: qr ?? (instance.qr_code ? { base64: instance.qr_code } : null),
    });
  } catch {
    // Retorno seguro sem erro 500
    return NextResponse.json({
      instance: { ...instance, status: instance.status || "qrcode" },
      qrcode: instance.qr_code ? { base64: instance.qr_code } : null,
    });
  }
}
