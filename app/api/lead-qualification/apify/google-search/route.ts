import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasApifyConfig, startApifyActor } from "@/src/lib/apify/client";
import { createApifyRun } from "@/src/lib/turso/apify-runs-repository";
import { getLeadById } from "@/src/lib/turso/leads-repository";

const schema = z.object({ leadId: z.string().uuid() });
export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  if (!hasApifyConfig()) return NextResponse.json({ error: "Apify não está configurado." }, { status: 503 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Lead inválido." }, { status: 400 });
  const lead = await getLeadById(user.id, parsed.data.leadId); if (!lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  const actorId = process.env.APIFY_GOOGLE_SEARCH_ACTOR_ID?.trim() || "apify/google-search-scraper";
  const query = `"${lead.name}" "${lead.city ?? ""}" instagram`;
  const run = await startApifyActor(actorId, { queries: query, maxPagesPerQuery: 1 });
  const stored = await createApifyRun({ actor_id: actorId, city: lead.city, dataset_id: run.defaultDatasetId ?? null, estimated_cost_usd: 0.03, metadata: { leadId: lead.id, query }, niche: lead.category, requested_limit: 1, run_id: run.id, source_type: "google_search", started_at: run.startedAt ?? new Date().toISOString(), status: "running", user_id: user.id });
  return NextResponse.json({ run: stored });
}
