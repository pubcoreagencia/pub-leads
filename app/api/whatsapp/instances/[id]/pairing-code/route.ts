import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTursoClient } from "@/src/lib/turso/client";
import { getEvolutionPairingCode } from "@/src/lib/whatsapp/evolution-client";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: "O número de telefone é obrigatório." }, { status: 400 });
    }

    const result = await getTursoClient().execute({
      args: [params.id, user.id],
      sql: "select server_url, api_key, instance_name from whatsapp_instances where id = ? and user_id = ?",
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });
    }

    const instance = result.rows[0];
    const serverUrl = String(instance.server_url);
    const apiKey = String(instance.api_key);
    const instanceName = String(instance.instance_name);

    // Fetch pairing code from Evolution API
    const { code } = await getEvolutionPairingCode(serverUrl, apiKey, instanceName, phone);

    // Update the phone in the database
    await getTursoClient().execute({
      args: [phone, params.id],
      sql: "update whatsapp_instances set phone = ? where id = ?",
    });

    return NextResponse.json({ code });
  } catch (error) {
    console.error("Erro ao gerar pairing code:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao gerar código." },
      { status: 500 }
    );
  }
}
