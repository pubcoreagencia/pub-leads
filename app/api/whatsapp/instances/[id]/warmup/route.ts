import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateWhatsappInstance, listWhatsappInstances } from "@/src/lib/turso/whatsapp-instances-repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { warmup_completed, warmup_progress_json } = body;

    const instances = await listWhatsappInstances(user.id);
    const instance = instances.find((i) => i.id === id);

    if (!instance) {
      return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });
    }

    await updateWhatsappInstance(user.id, instance.id, {
      warmup_completed,
      warmup_progress_json: warmup_progress_json ? JSON.stringify(warmup_progress_json) : null,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar maturação:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar dados de maturação." },
      { status: 500 },
    );
  }
}
