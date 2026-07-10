import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { getScrapingSessionWithResults, saveScrapingSessionResultsAsLeads } from "@/src/lib/turso/scraping-sessions-repository";
import { getUsageSummary } from "@/src/lib/usage/limits";

const paramsSchema = z.object({
  sessionId: z.string().uuid(),
});

const saveSchema = z.object({
  resultIds: z.array(z.string().uuid()).min(1).max(100),
});

async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const [parsedParams, parsedBody] = await Promise.all([
    paramsSchema.safeParseAsync(await context.params),
    saveSchema.safeParseAsync(await request.json()),
  ]);

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Resultados invalidos." }, { status: 400 });
  }

  const session = await getScrapingSessionWithResults(user.id, parsedParams.data.sessionId);

  if (!session) {
    return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
  }

  const requestedPending = session.results.filter(
    (result) => parsedBody.data.resultIds.includes(result.sessionResultId) && !result.saved,
  );
  const usage = await getUsageSummary(user.id, user.email);
  const leadLimit = usage.plan.limits.leadLimit;

  if (leadLimit !== null) {
    const remaining = leadLimit - usage.leadsUsed;

    if (requestedPending.length > remaining) {
      return NextResponse.json(
        { error: `Limite de leads do plano atingido. Restam ${Math.max(remaining, 0)} vagas.` },
        { status: 403 },
      );
    }
  }

  const result = await saveScrapingSessionResultsAsLeads(
    user.id,
    parsedParams.data.sessionId,
    parsedBody.data.resultIds,
  );
  const updated = await getScrapingSessionWithResults(user.id, parsedParams.data.sessionId);

  return NextResponse.json({ ...result, results: updated?.results ?? [], session: updated?.session ?? session.session });
}
