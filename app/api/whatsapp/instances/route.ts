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

  try {
    const { name, proxy } = await request.json();
    if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

    if (!hasEvolutionConfig()) {
      return NextResponse.json({ error: "Evolution API não configurada. Defina as variáveis de ambiente." }, { status: 500 });
    }

    const { serverUrl, apiKey } = getEvolutionConfig();
    const shortUserId = user.id.replace(/-/g, "").slice(0, 8);
    const instanceName = `pub_${shortUserId}_${Date.now()}`;

    // Cria a instância na Evolution API (passando proxy se fornecido)
    const { qrcode: directQr } = await createEvolutionInstance(serverUrl, apiKey, instanceName, proxy);

    let qrcode: { base64: string | null; code: string | null } | null = directQr;
    if (!qrcode?.base64) {
      try {
        qrcode = await getEvolutionQRCode(serverUrl, apiKey, instanceName);
      } catch {
        // Pode ser pego na checagem de status
      }
    }

    // 2. Persiste no Turso
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
