import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApifyRun } from "@/src/lib/apify/client";
import { getApifyRunByRunId, updateApifyRun } from "@/src/lib/turso/apify-runs-repository";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  const { runId } = await context.params; const stored = await getApifyRunByRunId(user.id, runId);
  if (!stored) return NextResponse.json({ error: "Run não encontrado." }, { status: 404 });
  const remote = await getApifyRun(runId);
  const status = remote.status === "SUCCEEDED" ? "succeeded" : remote.status === "FAILED" ? "failed" : remote.status === "ABORTED" ? "aborted" : "running";
  const run = await updateApifyRun(user.id, runId, { dataset_id: remote.defaultDatasetId ?? stored.dataset_id, estimated_cost_usd: remote.usageTotalUsd ?? stored.estimated_cost_usd, finished_at: remote.finishedAt ?? null, status });
  return NextResponse.json({ run });
}
