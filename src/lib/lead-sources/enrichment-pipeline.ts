import { discoverContactsFromWebsite } from "@/src/lib/lead-qualification/contact-enrichment";
import { getTursoClient } from "@/src/lib/turso/client";
import type { InValue } from "@libsql/client";

export type EnrichmentResultItem = {
  resultId: string;
  whatsapp: string | null;
  instagram: string | null;
  instagramUrl: string | null;
  email: string | null;
  status: "enriched" | "skipped" | "failed";
};

export type EnrichmentSummary = {
  enriched: number;
  skipped: number;
  failed: number;
  results: EnrichmentResultItem[];
};

type ResultRow = {
  id: string;
  website: string | null;
  email: string | null;
};

// Executa tasks com limite de concorrência sem dependências externas
async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const settled: PromiseSettledResult<T>[] = [];
  const executing = new Set<Promise<unknown>>();

  for (const task of tasks) {
    const p = task()
      .then(
        (value) => settled.push({ status: "fulfilled", value }),
        (reason) => settled.push({ status: "rejected", reason }),
      )
      .finally(() => executing.delete(p));

    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.allSettled(executing);
  return settled;
}

export async function enrichSessionResultsFromWebsite(
  userId: string,
  sessionId: string,
  resultIds: string[],
): Promise<EnrichmentSummary> {
  if (resultIds.length === 0) {
    return { enriched: 0, failed: 0, results: [], skipped: 0 };
  }

  const client = getTursoClient();
  const idPlaceholders = resultIds.map(() => "?").join(", ");

  // 1. Busca todos os resultados de uma vez
  const fetchResult = await client.execute({
    args: [userId, sessionId, ...resultIds] as InValue[],
    sql: `select id, website, email from scraping_session_results
          where user_id = ? and session_id = ? and id in (${idPlaceholders})`,
  });

  const rows = fetchResult.rows as unknown as ResultRow[];
  const withWebsite = rows.filter((r) => r.website?.trim());
  const withoutWebsite = rows.filter((r) => !r.website?.trim());

  const output: EnrichmentResultItem[] = withoutWebsite.map((r) => ({
    email: null,
    instagram: null,
    instagramUrl: null,
    resultId: r.id,
    status: "skipped",
    whatsapp: null,
  }));

  // 2. Enriquece com concorrência máxima de 5
  await runConcurrent(
    withWebsite.map((row) => async () => {
      try {
        const enrichment = await discoverContactsFromWebsite(row.website);

        const whatsapp = enrichment.whatsapp_candidate ?? null;
        const instagramHandle = enrichment.instagram_handle ?? null;
        const instagramUrl = enrichment.instagram_url ?? null;
        // Só sobrescreve email se não havia antes
        const email = row.email?.trim() ? null : (enrichment.email ?? null);

        await client.execute({
          args: [
            whatsapp,
            instagramUrl,
            instagramHandle,
            email,
            enrichment.whatsapp_status,
            enrichment.instagram_status,
            userId,
            row.id,
          ] as InValue[],
          sql: `update scraping_session_results
                set
                  whatsapp = coalesce(?, whatsapp),
                  instagram_url = coalesce(?, instagram_url),
                  instagram_handle = coalesce(?, instagram_handle),
                  email = coalesce(email, ?),
                  whatsapp_status = coalesce(?, whatsapp_status),
                  instagram_status = coalesce(?, instagram_status),
                  updated_at = current_timestamp
                where user_id = ? and id = ?`,
        });

        output.push({
          email: email ?? row.email ?? null,
          instagram: instagramHandle,
          instagramUrl,
          resultId: row.id,
          status: "enriched",
          whatsapp,
        });
      } catch {
        output.push({
          email: null,
          instagram: null,
          instagramUrl: null,
          resultId: row.id,
          status: "failed",
          whatsapp: null,
        });
      }
    }),
    5,
  );

  const enriched = output.filter((r) => r.status === "enriched").length;
  const skipped = output.filter((r) => r.status === "skipped").length;
  const failed = output.filter((r) => r.status === "failed").length;

  return { enriched, failed, results: output, skipped };
}
