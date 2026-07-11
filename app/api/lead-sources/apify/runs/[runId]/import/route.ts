import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApifyDatasetItems } from "@/src/lib/apify/client";
import {
  mapApifyGenericItem,
  mapApifyGoogleMapsItem,
  mapApifyGoogleSearchItem,
  mapApifyInstagramItem,
} from "@/src/lib/apify/mappers";
import { getApifyRunByRunId, updateApifyRun } from "@/src/lib/turso/apify-runs-repository";
import { updateScrapingSession, upsertScrapingSessionResults } from "@/src/lib/turso/scraping-sessions-repository";

function mapApifyItem(item: Record<string, unknown>, run: NonNullable<Awaited<ReturnType<typeof getApifyRunByRunId>>>) {
  const city = run.city ?? "";
  const niche = run.niche ?? null;
  const state = typeof run.metadata.state === "string" ? run.metadata.state : "";
  const category = run.source_category ?? run.source_type;

  if (category === "instagram") {
    return mapApifyInstagramItem(item, city, state, niche);
  }

  if (category === "google_search") {
    return mapApifyGoogleSearchItem(item, city, state, niche);
  }

  if (category === "google_maps") {
    return mapApifyGoogleMapsItem(item, city, state, niche);
  }

  return mapApifyGenericItem(item, city, state, niche);
}

export async function POST(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  const { runId } = await context.params; const run = await getApifyRunByRunId(user.id, runId);
  if (!run || !run.dataset_id) return NextResponse.json({ error: "Dataset Apify ainda não está disponível." }, { status: 409 });
  const items = await getApifyDatasetItems<Record<string, unknown>>(run.dataset_id, run.requested_limit);
  const leads = items.map((item) => mapApifyItem(item, run));
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
