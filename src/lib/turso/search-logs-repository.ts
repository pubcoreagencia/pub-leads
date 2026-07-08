import { getTursoClient } from "@/src/lib/turso/client";
import { rowToSearchLog, stringifyJson } from "@/src/lib/turso/mappers";
import type { CountPoint, SearchLogWriteInput } from "@/src/lib/turso/types";

const selectSearchLogSql =
  "select id, user_id, query, city, state, country, category, result_count, source, status, raw_params, created_at from search_logs";

function getMonthStart() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  return monthStart.toISOString();
}

export async function createSearchLog(userId: string, data: SearchLogWriteInput) {
  const id = data.id ?? crypto.randomUUID();
  const createdAt = data.created_at ?? new Date().toISOString();

  await getTursoClient().execute({
    args: [
      id,
      userId,
      data.query ?? null,
      data.city ?? null,
      data.state ?? null,
      data.country ?? null,
      data.category ?? null,
      data.result_count ?? 0,
      data.source ?? null,
      data.status ?? "success",
      stringifyJson(data.raw_params ?? {}),
      createdAt,
    ],
    sql: "insert into search_logs (id, user_id, query, city, state, country, category, result_count, source, status, raw_params, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  });

  const result = await getTursoClient().execute({
    args: [userId, id],
    sql: `${selectSearchLogSql} where user_id = ? and id = ? limit 1`,
  });

  if (!result.rows[0]) {
    throw new Error("Log de busca criado, mas nao encontrado no Turso.");
  }

  return rowToSearchLog(result.rows[0]);
}

export async function countSearchesThisMonth(userId: string) {
  const result = await getTursoClient().execute({
    args: [userId, getMonthStart()],
    sql: "select count(*) as total from search_logs where user_id = ? and status = 'success' and datetime(created_at) >= datetime(?)",
  });

  return Number(result.rows[0]?.total ?? 0);
}

export async function listRecentSearches(userId: string, limit = 100) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 1000);
  const result = await getTursoClient().execute({
    args: [userId, safeLimit],
    sql: `${selectSearchLogSql} where user_id = ? order by datetime(created_at) desc limit ?`,
  });

  return result.rows.map(rowToSearchLog);
}

export async function countBySource(userId: string) {
  const result = await getTursoClient().execute({
    args: [userId],
    sql: "select coalesce(source, '') as label, count(*) as value from search_logs where user_id = ? group by source",
  });

  return result.rows.map((row): CountPoint => ({
    label: String(row.label || "Sem fonte"),
    value: Number(row.value ?? 0),
  }));
}
