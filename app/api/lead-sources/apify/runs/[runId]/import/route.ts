import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApifyDatasetItems } from "@/src/lib/apify/client";
import { mapApifyGoogleMapsItem } from "@/src/lib/apify/mappers";
import { getApifyRunByRunId, updateApifyRun } from "@/src/lib/turso/apify-runs-repository";
import { updateScrapingSession, upsertScrapingSessionResults } from "@/src/lib/turso/scraping-sessions-repository";

export async function POST(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  const { runId } = await context.params; const run = await getApifyRunByRunId(user.id, runId);
  if (!run || !run.dataset_id) return NextResponse.json({ error: "Dataset Apify ainda não está disponível." }, { status: 409 });
  const items = await getApifyDatasetItems<Record<string, unknown>>(run.dataset_id, run.requested_limit);
  const leads = items.map((item) => mapApifyGoogleMapsItem(item, run.city ?? "", String(run.metadata.state ?? "")));
  const sessionId = typeof run.metadata.sessionId === "string" ? run.metadata.sessionId : null;
  let sessionPayload = null;
  if (sessionId) {
    const results = await upsertScrapingSessionResults(user.id, sessionId, leads);
    const session = await updateScrapingSession(user.id, sessionId, {
      apify_dataset_id: run.dataset_id,
      results_count: results.length,
      status: "completed",
    });
    sessionPayload = { results, session };
  }
  await updateApifyRun(user.id, runId, { results_count: leads.length, status: "succeeded" });
  return NextResponse.json({ results: sessionPayload?.results ?? leads, session: sessionPayload?.session ?? null });
}
