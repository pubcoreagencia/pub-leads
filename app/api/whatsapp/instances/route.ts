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
import { getEvolutionConfig, hasEvolutionConfig } from "@/src/lib/whatsapp/config";

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

  // Verifica se a Evolution API está configurada no servidor
  if (!hasEvolutionConfig()) {
    return NextResponse.json(
      { error: "Evolution API não configurada no servidor. Contate o administrador." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { name } = body as { name: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "O nome da instância é obrigatório." }, { status: 400 });
    }

    // Lê credenciais globais do servidor (env vars)
    const { serverUrl, apiKey } = getEvolutionConfig();

    // Gera um nome único para a instância na Evolution API
    // Formato: publeads_{primeiros 8 chars do userId}_{timestamp}
    const shortUserId = user.id.replace(/-/g, "").slice(0, 8);
    const instanceName = `pl_${shortUserId}_${Date.now()}`;

    // 1. Cria a instância na Evolution API
    await createEvolutionInstance(serverUrl, apiKey, instanceName);

    // 2. Busca o QR Code
    let qrcode = null;
    try {
      qrcode = await getEvolutionQRCode(serverUrl, apiKey, instanceName);
    } catch {
      // QR Code pode não estar disponível imediatamente — tudo bem
    }

    // 3. Persiste no Turso (armazena server_url e api_key para compatibilidade futura)
    const instance = await createWhatsappInstance({
      userId: user.id,
      name: name.trim(),
      serverUrl,
      apiKey,
      instanceName,
      status: qrcode?.base64 ? "qrcode" : "close",
      qrCode: qrcode?.base64 ?? null,
    });

    return NextResponse.json({ instance, qrcode }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar instância." },
      { status: 500 },
    );
  }
}
