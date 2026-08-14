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
    const shortUserId = user.id.replace(/-/g, "").slice(0, 8);
    const instanceName = `pub_${shortUserId}_${Date.now()}`;

    // 1. Cria a instância na Evolution API
    await createEvolutionInstance(serverUrl, apiKey, instanceName);

    // 2. Busca o QR Code
    let qrcode = null;
    try {
      qrcode = await getEvolutionQRCode(serverUrl, apiKey, instanceName);
    } catch {
      // QR Code pode ser obtido depois na checagem de status
    }

    // 3. Persiste no Turso com a assinatura correta (userId, data)
    const instance = await createWhatsappInstance(user.id, {
      name: name.trim(),
      server_url: serverUrl,
      api_key: apiKey,
      instance_name: instanceName,
    });

    return NextResponse.json({ instance, qrcode }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar instância." },
      { status: 500 },
    );
  }
}
