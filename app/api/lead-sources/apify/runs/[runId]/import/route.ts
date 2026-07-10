import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApifyDatasetItems } from "@/src/lib/apify/client";
import { mapApifyGoogleMapsItem } from "@/src/lib/apify/mappers";
import { getApifyRunByRunId, updateApifyRun } from "@/src/lib/turso/apify-runs-repository";

export async function POST(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  const { runId } = await context.params; const run = await getApifyRunByRunId(user.id, runId);
  if (!run || !run.dataset_id) return NextResponse.json({ error: "Dataset Apify ainda não está disponível." }, { status: 409 });
  const items = await getApifyDatasetItems<Record<string, unknown>>(run.dataset_id, run.requested_limit);
  const leads = items.map((item) => mapApifyGoogleMapsItem(item, run.city ?? "", String(run.metadata.state ?? "")));
  await updateApifyRun(user.id, runId, { results_count: leads.length, status: "succeeded" });
  return NextResponse.json({ results: leads });
}
