import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteWhatsappInstance,
  listWhatsappInstances,
} from "@/src/lib/turso/whatsapp-instances-repository";
import { deleteEvolutionInstance } from "@/src/lib/whatsapp/evolution-client";

export async function DELETE(
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
    await deleteEvolutionInstance(instance.server_url, instance.api_key, instance.instance_name);
    await deleteWhatsappInstance(user.id, instance.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro ao remover instância.",
    }, { status: 500 });
  }
}
