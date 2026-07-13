import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getTursoUnavailableMessage, hasTursoConfig } from "@/src/lib/turso/client";
import { listMessageFunnels } from "@/src/lib/turso/message-funnels-repository";

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
