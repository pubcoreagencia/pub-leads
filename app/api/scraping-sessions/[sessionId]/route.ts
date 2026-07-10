import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import {
  deleteScrapingSession,
  getScrapingSessionWithResults,
  updateScrapingSession,
} from "@/src/lib/turso/scraping-sessions-repository";

const paramsSchema = z.object({
  sessionId: z.string().uuid(),
});

const patchSchema = z.object({
  apify_dataset_id: z.string().trim().nullable().optional(),
  apify_run_id: z.string().trim().nullable().optional(),
  error_message: z.string().trim().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  results_count: z.number().int().min(0).optional(),
  selected_count: z.number().int().min(0).optional(),
  source_run_id: z.string().trim().nullable().optional(),
  status: z.enum(["idle", "running", "completed", "failed", "cancelled"]).optional(),
});

async function getUserId() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 400 });
  }

  const session = await getScrapingSessionWithResults(userId, parsedParams.data.sessionId);

  if (!session) {
    return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const [parsedParams, parsedBody] = await Promise.all([
    paramsSchema.safeParseAsync(await context.params),
    patchSchema.safeParseAsync(await request.json()),
  ]);

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 400 });
  }

  const session = await updateScrapingSession(userId, parsedParams.data.sessionId, parsedBody.data);

  if (!session) {
    return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
  }

  const payload = await getScrapingSessionWithResults(userId, parsedParams.data.sessionId);

  return NextResponse.json(payload);
}

export async function DELETE(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 400 });
  }

  const deleted = await deleteScrapingSession(userId, parsedParams.data.sessionId);

  if (!deleted) {
    return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
