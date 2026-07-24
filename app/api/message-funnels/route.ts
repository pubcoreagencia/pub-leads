import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getTursoUnavailableMessage, hasTursoConfig } from "@/src/lib/turso/client";
import { createMessageFunnelFromBaseCopy, listMessageFunnels } from "@/src/lib/turso/message-funnels-repository";

const createFunnelSchema = z.object({
  baseCopy: z.string().trim().min(10).max(8000),
  name: z.string().trim().min(2).max(80),
});

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function GET() {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const funnels = await listMessageFunnels(userId);

  return NextResponse.json({ funnels });
}

export async function POST(request: Request) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = createFunnelSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const funnel = await createMessageFunnelFromBaseCopy(userId, parsed.data);

  return NextResponse.json({ funnel });
}
