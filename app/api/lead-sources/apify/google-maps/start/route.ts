import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { estimateApifyGoogleMapsCost, getApifyGoogleMapsLimit, getApifyMonthlyBudget } from "@/src/lib/apify/budget";
import { hasApifyConfig, startApifyActor } from "@/src/lib/apify/client";
import { canUseLeadSearchSource } from "@/src/lib/permissions/source-permissions";
import { createApifyRun, getApifyMonthlySpend } from "@/src/lib/turso/apify-runs-repository";
import { updateScrapingSession } from "@/src/lib/turso/scraping-sessions-repository";

const schema = z.object({
  city: z.string().trim().min(2),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  niche: z.string().trim().min(2),
  sessionId: z.string().uuid().optional(),
  state: z.string().trim().min(2),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  if (!(await canUseLeadSearchSource(user, "apify_google_maps"))) return NextResponse.json({ error: "Apify Google Maps está disponível apenas no modo desenvolvedor." }, { status: 403 });
  if (!hasApifyConfig()) return NextResponse.json({ error: "Apify não está configurado." }, { status: 503 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros Apify inválidos." }, { status: 400 });
  const limit = Math.min(parsed.data.limit ?? getApifyGoogleMapsLimit(), getApifyGoogleMapsLimit());
  const estimate = estimateApifyGoogleMapsCost(limit);
  const spent = await getApifyMonthlySpend(user.id);
  if (spent + estimate > getApifyMonthlyBudget()) return NextResponse.json({ error: "Orçamento Apify mensal atingido." }, { status: 402 });
  const actorId = process.env.APIFY_GOOGLE_MAPS_ACTOR_ID?.trim() || "compass/crawler-google-places";
  try {
    const run = await startApifyActor(actorId, { searchStringsArray: [`${parsed.data.niche} em ${parsed.data.city}, ${parsed.data.state}, Brasil`], maxCrawledPlacesPerSearch: limit, maxImages: 0, maxReviews: 0, includeReviews: false });
    const stored = await createApifyRun({ actor_id: actorId, city: parsed.data.city, dataset_id: run.defaultDatasetId ?? null, estimated_cost_usd: estimate, metadata: { sessionId: parsed.data.sessionId ?? null, state: parsed.data.state }, niche: parsed.data.niche, requested_limit: limit, run_id: run.id, source_type: "google_maps", started_at: run.startedAt ?? new Date().toISOString(), status: "running", user_id: user.id });
    if (parsed.data.sessionId) {
      await updateScrapingSession(user.id, parsed.data.sessionId, {
        apify_dataset_id: run.defaultDatasetId ?? null,
        apify_run_id: run.id,
        source_run_id: run.id,
        status: "running",
      });
    }
    return NextResponse.json({ budget: { limit: getApifyMonthlyBudget(), spent, estimated: estimate }, run: stored });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível iniciar Apify." }, { status: 400 }); }
}
