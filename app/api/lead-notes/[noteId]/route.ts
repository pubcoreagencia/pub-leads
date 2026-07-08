import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { deleteNote } from "@/src/lib/turso/lead-notes-repository";

const paramsSchema = z.object({
  noteId: z.string().uuid(),
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

export async function DELETE(_request: Request, context: { params: Promise<{ noteId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Nota invalida." }, { status: 400 });
  }

  const deleted = await deleteNote(userId, parsedParams.data.noteId);

  if (!deleted) {
    return NextResponse.json({ error: "Nota nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
