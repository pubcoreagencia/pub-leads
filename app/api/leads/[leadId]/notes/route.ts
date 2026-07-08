import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { createNote, listNotesByLead } from "@/src/lib/turso/lead-notes-repository";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

const noteSchema = z.object({
  content: z.string().trim().min(1).max(3000),
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

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Lead invalido." }, { status: 400 });
  }

  const notes = await listNotesByLead(userId, parsedParams.data.leadId);

  return NextResponse.json({ notes });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const [parsedParams, parsedBody] = await Promise.all([
    paramsSchema.safeParseAsync(await context.params),
    noteSchema.safeParseAsync(await request.json()),
  ]);

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Nota invalida." }, { status: 400 });
  }

  const note = await createNote(userId, parsedParams.data.leadId, parsedBody.data.content);

  return NextResponse.json({ note });
}
