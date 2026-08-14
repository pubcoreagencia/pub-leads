import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createWhatsappInstance,
  listWhatsappInstances,
} from "@/src/lib/turso/whatsapp-instances-repository";
import {
  createEvolutionInstance,
  getEvolutionQRCode,
} from "@/src/lib/whatsapp/evolution-client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const instances = await listWhatsappInstances(user.id);
    return NextResponse.json({ instances });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao listar instâncias." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const body = await request.json();
    const { name, serverUrl, apiKey } = body;

    if (!name || !serverUrl || !apiKey) {
      return NextResponse.json({ error: "Nome, URL do servidor e API Key são obrigatórios." }, { status: 400 });
    }

    // Gera um identificador único para a Evolution API
    const instanceName = `pub_${user.id.slice(0, 8)}_${Date.now()}`;

    // Cria no servidor da Evolution API
    await createEvolutionInstance(serverUrl, apiKey, instanceName);

    // Salva no banco Turso
    const instance = await createWhatsappInstance(user.id, {
      name,
      server_url: serverUrl,
      api_key: apiKey,
      instance_name: instanceName,
    });

    // Tenta obter o QR code inicial
    let qr = null;
    try {
      qr = await getEvolutionQRCode(serverUrl, apiKey, instanceName);
    } catch {
      // O QR Code pode ser obtido depois se demorar
    }

    return NextResponse.json({ instance, qrcode: qr });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao criar instância de WhatsApp." }, { status: 500 });
  }
}
