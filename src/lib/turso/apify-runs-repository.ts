import { getTursoClient } from "@/src/lib/turso/client";
import type { InValue } from "@libsql/client";
import type { ApifyRunRecord, ApifyRunStatus, ApifySourceType } from "@/src/lib/apify/types";

function rowToRun(row: Record<string, unknown>): ApifyRunRecord {
  return { ...row, actor_id: String(row.actor_id), city: row.city ? String(row.city) : null, dataset_id: row.dataset_id ? String(row.dataset_id) : null, estimated_cost_usd: Number(row.estimated_cost_usd ?? 0), finished_at: row.finished_at ? String(row.finished_at) : null, id: String(row.id), metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : {}, niche: row.niche ? String(row.niche) : null, requested_limit: Number(row.requested_limit ?? 0), results_count: Number(row.results_count ?? 0), run_id: String(row.run_id), source_type: String(row.source_type) as ApifySourceType, started_at: String(row.started_at), status: String(row.status) as ApifyRunStatus, user_id: String(row.user_id) };
}

export async function getApifyMonthlySpend(userId: string) {
  const row = (await getTursoClient().execute({ args: [userId], sql: "select coalesce(sum(estimated_cost_usd), 0) as total from apify_runs where user_id = ? and started_at >= date('now', 'start of month')" })).rows[0];
  return Number(row?.total ?? 0);
}

export async function createApifyRun(input: Omit<ApifyRunRecord, "id" | "finished_at" | "results_count">) {
  const id = crypto.randomUUID();
  await getTursoClient().execute({ args: [id, input.user_id, input.actor_id, input.run_id, input.dataset_id, input.source_type, input.city, input.niche, input.status, input.requested_limit, input.estimated_cost_usd, input.started_at, JSON.stringify(input.metadata)], sql: "insert into apify_runs (id,user_id,actor_id,run_id,dataset_id,source_type,city,niche,status,requested_limit,estimated_cost_usd,started_at,metadata) values (?,?,?,?,?,?,?,?,?,?,?,?,?)" });
  return getApifyRunByRunId(input.user_id, input.run_id);
}

export async function getApifyRunByRunId(userId: string, runId: string) {
  const row = (await getTursoClient().execute({ args: [userId, runId], sql: "select * from apify_runs where user_id = ? and run_id = ? limit 1" })).rows[0];
  return row ? rowToRun(row as Record<string, unknown>) : null;
}

export async function updateApifyRun(userId: string, runId: string, data: Partial<Pick<ApifyRunRecord, "dataset_id" | "status" | "results_count" | "finished_at" | "metadata" | "estimated_cost_usd">>) {
  const fields = Object.entries(data).filter(([, value]) => value !== undefined);
  if (!fields.length) return getApifyRunByRunId(userId, runId);
  const args: InValue[] = fields.map(([key, value]) => (key === "metadata" ? JSON.stringify(value) : value) as InValue);
  args.push(userId, runId);
  await getTursoClient().execute({ args, sql: `update apify_runs set ${fields.map(([key]) => `${key} = ?`).join(", ")} where user_id = ? and run_id = ?` });
  return getApifyRunByRunId(userId, runId);
}
