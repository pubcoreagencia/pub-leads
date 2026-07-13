import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { estimateApifyRunCost, getApifyMaxResultsPerRun, getApifyMonthlyBudget } from "@/src/lib/apify/budget";
import { hasApifyConfig, startApifyActor, startApifyTask } from "@/src/lib/apify/client";
import { resolveApifySource } from "@/src/lib/apify/source-registry";
import { canSelectLeadSource } from "@/src/lib/permissions/source-permissions";
import { createApifyRun, getApifyMonthlySpend } from "@/src/lib/turso/apify-runs-repository";
import { updateScrapingSession } from "@/src/lib/turso/scraping-sessions-repository";

const schema = z.object({
  city: z.string().trim().optional(),
  expectedCategory: z.enum(["google_maps", "instagram", "google_search", "generic"]).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  niche: z.string().trim().optional(),
  requestedLimit: z.coerce.number().int().min(1).max(100).optional(),
  sessionId: z.string().uuid().optional(),
  sourceId: z.string().trim().min(3),
  state: z.string().trim().optional(),
});

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getNicheAliases(niche: string) {
  const normalized = niche
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "clinica") {
    return ["clinicas", "clínicas", "clinica medica", "clínica médica"];
  }

  if (normalized === "dentista") {
    return ["dentistas", "clinica odontologica", "clínica odontológica"];
  }

  return [];
}

function buildGoogleMapsQueries(data: z.infer<typeof schema>) {
  const city = data.city ?? "";
  const state = data.state ?? "";
  const niche = data.niche ?? "";
  const inputQuery = typeof data.input?.query === "string" ? data.input.query : "";
  const location = [city, state, "Brasil"].filter(Boolean).join(", ");
  const aliases = getNicheAliases(niche);

  return unique([
    inputQuery,
    [niche, city, state, "Brasil"].filter(Boolean).join(" "),
    niche && location ? `${niche} em ${location}` : "",
    ...aliases.map((alias) => (location ? `${alias} em ${location}` : alias)),
  ]).slice(0, 4);
}

function buildGoogleMapsInput(base: Record<string, unknown>, data: z.infer<typeof schema>, limit: number) {
  const query = String(data.input?.query ?? [data.niche, data.city, data.state, "Brasil"].filter(Boolean).join(" "));
  const searchStringsArray = buildGoogleMapsQueries(data);
  const perSearchLimit = Math.max(1, Math.ceil(limit / Math.max(searchStringsArray.length, 1)));

  return {
    ...base,
    ...(data.input ?? {}),
    includeReviews: false,
    language: "pt-BR",
    limit,
    maxCrawledPlaces: limit,
    maxCrawledPlacesPerSearch: perSearchLimit,
    maxImages: 0,
    maxItems: limit,
    maxPlacesPerSearch: perSearchLimit,
    maxResults: limit,
    maxReviews: 0,
    query,
    resultsLimit: limit,
    search: query,
    searchStringsArray: searchStringsArray.length > 0 ? searchStringsArray : [query],
  };
}

function buildSourceInput(source: Awaited<ReturnType<typeof resolveApifySource>>, data: z.infer<typeof schema>, limit: number) {
  const city = data.city ?? "";
  const state = data.state ?? "";
  const niche = data.niche ?? "";
  const query = String(data.input?.query ?? [niche, city, state, "Brasil"].filter(Boolean).join(" "));
  const base = source?.defaultInput && typeof source.defaultInput === "object" ? source.defaultInput : {};

  if (source?.category === "google_maps") {
    return buildGoogleMapsInput(base, data, limit);
  }

  if (source?.kind === "task") {
    return { ...base, ...(data.input ?? {}) };
  }

  if (source?.category === "instagram") {
    return {
      ...base,
      ...(data.input ?? {}),
      directUrls: Array.isArray(data.input?.directUrls) ? data.input?.directUrls : undefined,
      resultsLimit: limit,
      search: query,
      searchLimit: limit,
      searchType: data.input?.mode === "hashtag" ? "hashtag" : "user",
    };
  }

  if (source?.category === "google_search") {
    return {
      ...base,
      ...(data.input ?? {}),
      maxPagesPerQuery: 1,
      queries: [query],
      resultsPerPage: limit,
    };
  }

  return { ...base, ...(data.input ?? {}), limit, query };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  if (!(await canSelectLeadSource(user))) {
    return NextResponse.json({ error: "Fontes Apify avancadas estao disponiveis apenas para contas internas." }, { status: 403 });
  }

  if (!hasApifyConfig()) {
    return NextResponse.json({ error: "Apify nao esta configurado." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros Apify invalidos." }, { status: 400 });
  }

  const source = await resolveApifySource(user.id, parsed.data.sourceId);

  if (!source) {
    return NextResponse.json({ error: "Fonte Apify nao permitida." }, { status: 403 });
  }

  if (parsed.data.expectedCategory && source.category !== parsed.data.expectedCategory) {
    return NextResponse.json({ error: "A fonte Apify selecionada nao corresponde ao tipo de busca." }, { status: 400 });
  }

  const limit = Math.min(parsed.data.requestedLimit ?? getApifyMaxResultsPerRun(), getApifyMaxResultsPerRun());
  const estimate = estimateApifyRunCost(source.category, limit);
  const spent = await getApifyMonthlySpend(user.id);
  const budget = getApifyMonthlyBudget();

  if (spent + estimate > budget) {
    return NextResponse.json({ error: "Orcamento Apify mensal atingido." }, { status: 402 });
  }

  const input = buildSourceInput(source, parsed.data, limit);
  const run = source.kind === "task" && source.taskId
    ? await startApifyTask(source.taskId, input)
    : await startApifyActor(source.actorId ?? "", input);

  const stored = await createApifyRun({
    actor_id: source.actorId ?? source.taskId ?? source.id,
    city: parsed.data.city ?? null,
    dataset_id: run.defaultDatasetId ?? null,
    estimated_cost_usd: estimate,
    metadata: {
      input,
      leadMapping: source.leadMapping,
      sessionId: parsed.data.sessionId ?? null,
      sourceCategory: source.category,
      sourceId: source.id,
      state: parsed.data.state ?? null,
    },
    niche: parsed.data.niche ?? null,
    requested_limit: limit,
    run_id: run.id,
    source_category: source.category,
    source_id: source.id,
    source_name: source.name,
    source_type: source.category,
    started_at: run.startedAt ?? new Date().toISOString(),
    status: "running",
    task_id: source.taskId,
    user_id: user.id,
  });

  if (parsed.data.sessionId) {
    await updateScrapingSession(user.id, parsed.data.sessionId, {
      apify_dataset_id: run.defaultDatasetId ?? null,
      apify_run_id: run.id,
      source_run_id: run.id,
      status: "running",
    });
  }

  return NextResponse.json({
    budget: { estimated: estimate, limit: budget, spent },
    run: stored,
    source,
  });
}
