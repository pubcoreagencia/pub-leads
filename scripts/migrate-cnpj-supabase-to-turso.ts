import { performance } from "node:perf_hooks";

import { loadEnvConfig } from "@next/env";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createTursoClient, type Client, type InValue } from "@libsql/client";

loadEnvConfig(process.cwd());

type JsonRecord = Record<string, unknown>;

type SupabaseCnpjRow = {
  bairro: string | null;
  cnae_fiscal: string | null;
  cnae_fiscal_descricao: string | null;
  cnpj: string;
  cnpj_basico: string | null;
  cnpj_dv: string | null;
  cnpj_ordem: string | null;
  complemento: string | null;
  created_at: string;
  data_inicio_atividade: string | null;
  data_situacao_cadastral: string | null;
  ddd_1: string | null;
  ddd_2: string | null;
  email: string | null;
  is_headquarters: boolean | null;
  logradouro: string | null;
  municipio: string;
  nome_fantasia: string | null;
  numero: string | null;
  raw_data: JsonRecord | string | null;
  razao_social: string | null;
  situacao_cadastral: string | null;
  telefone_1: string | null;
  telefone_2: string | null;
  tipo_logradouro: string | null;
  uf: string;
  updated_at: string;
  cep: string | null;
};

type TursoCnpjRow = {
  bairro: string | null;
  cnae_fiscal: string | null;
  cnae_fiscal_descricao: string | null;
  cnpj: string;
  cnpj_basico: string | null;
  cnpj_dv: string | null;
  cnpj_ordem: string | null;
  complemento: string | null;
  created_at: string;
  data_inicio_atividade: string | null;
  data_situacao_cadastral: string | null;
  ddd_1: string | null;
  ddd_2: string | null;
  email: string | null;
  is_headquarters: number | null;
  logradouro: string | null;
  municipio: string;
  nome_fantasia: string | null;
  numero: string | null;
  raw_data: string;
  razao_social: string | null;
  situacao_cadastral: string | null;
  telefone_1: string | null;
  telefone_2: string | null;
  tipo_logradouro: string | null;
  uf: string;
  updated_at: string;
  cep: string | null;
};

const cnpjColumns = [
  "cnpj",
  "cnpj_basico",
  "cnpj_ordem",
  "cnpj_dv",
  "is_headquarters",
  "razao_social",
  "nome_fantasia",
  "situacao_cadastral",
  "data_situacao_cadastral",
  "data_inicio_atividade",
  "cnae_fiscal",
  "cnae_fiscal_descricao",
  "tipo_logradouro",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cep",
  "uf",
  "municipio",
  "ddd_1",
  "telefone_1",
  "ddd_2",
  "telefone_2",
  "email",
  "raw_data",
  "created_at",
  "updated_at",
] as const;

const mutableColumns = cnpjColumns.filter((column) => column !== "cnpj" && column !== "created_at") as Array<
  Exclude<(typeof cnpjColumns)[number], "cnpj" | "created_at">
>;

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

const sourceBatchSize = readPositiveInt(process.env.CNPJ_MIGRATION_BATCH_SIZE, 1000);
const writeBatchSize = readPositiveInt(process.env.CNPJ_MIGRATION_WRITE_BATCH_SIZE, 200);

function isLocalUrl(url: string) {
  return url.startsWith("file:") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
}

function loadRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Defina ${name} antes de rodar a migracao de CNPJ.`);
  }

  return value;
}

function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function normalizeDate(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeTimestamp(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return new Date().toISOString();
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function normalizeBoolean(value: unknown) {
  if (value === true) {
    return 1;
  }

  if (value === false) {
    return 0;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return 1;
    }

    if (value === 0) {
      return 0;
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return 1;
    }

    if (normalized === "false" || normalized === "0") {
      return 0;
    }
  }

  return null;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as JsonRecord).sort(([left], [right]) => left.localeCompare(right));

    return entries.reduce<JsonRecord>((accumulator, [key, nested]) => {
      accumulator[key] = sortJson(nested);
      return accumulator;
    }, {});
  }

  return value;
}

function normalizeJson(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.stringify(sortJson(JSON.parse(value)));
    } catch {
      return "{}";
    }
  }

  if (!value || typeof value !== "object") {
    return "{}";
  }

  return JSON.stringify(sortJson(value));
}

function toTursoRow(row: SupabaseCnpjRow): TursoCnpjRow {
  const cnpj = cleanText(row.cnpj);
  const uf = cleanText(row.uf)?.toUpperCase();
  const municipio = cleanText(row.municipio);

  if (!cnpj) {
    throw new Error("CNPJ ausente em linha da origem Supabase.");
  }

  if (!uf) {
    throw new Error(`UF ausente para o CNPJ ${cnpj}.`);
  }

  if (!municipio) {
    throw new Error(`Municipio ausente para o CNPJ ${cnpj}.`);
  }

  return {
    bairro: cleanText(row.bairro),
    cnae_fiscal: cleanText(row.cnae_fiscal),
    cnae_fiscal_descricao: cleanText(row.cnae_fiscal_descricao),
    cnpj,
    cnpj_basico: cleanText(row.cnpj_basico),
    cnpj_dv: cleanText(row.cnpj_dv),
    cnpj_ordem: cleanText(row.cnpj_ordem),
    complemento: cleanText(row.complemento),
    created_at: normalizeTimestamp(row.created_at),
    data_inicio_atividade: normalizeDate(row.data_inicio_atividade),
    data_situacao_cadastral: normalizeDate(row.data_situacao_cadastral),
    ddd_1: cleanText(row.ddd_1),
    ddd_2: cleanText(row.ddd_2),
    email: cleanText(row.email)?.toLowerCase() ?? null,
    is_headquarters: normalizeBoolean(row.is_headquarters),
    logradouro: cleanText(row.logradouro),
    municipio,
    nome_fantasia: cleanText(row.nome_fantasia),
    numero: cleanText(row.numero),
    raw_data: normalizeJson(row.raw_data),
    razao_social: cleanText(row.razao_social),
    situacao_cadastral: cleanText(row.situacao_cadastral),
    telefone_1: cleanText(row.telefone_1),
    telefone_2: cleanText(row.telefone_2),
    tipo_logradouro: cleanText(row.tipo_logradouro),
    uf,
    updated_at: normalizeTimestamp(row.updated_at),
    cep: cleanText(row.cep),
  };
}

function toDbValue(row: TursoCnpjRow, column: (typeof cnpjColumns)[number]): InValue {
  return row[column] ?? null;
}

function chunk<T>(items: T[], size: number) {
  const safeSize = Math.max(1, Math.trunc(size));
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }

  return chunks;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

async function fetchSupabaseBatch(
  supabase: SupabaseClient,
  lastCnpj: string | null,
  limit: number,
) {
  let query = supabase
    .from("cnpj_establishments")
    .select("*")
    .order("cnpj", { ascending: true })
    .limit(limit);

  if (lastCnpj) {
    query = query.gt("cnpj", lastCnpj);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as SupabaseCnpjRow[];
}

async function countSupabaseRows(supabase: SupabaseClient) {
  const { count, error } = await supabase
    .from("cnpj_establishments")
    .select("cnpj", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function upsertBatch(turso: Client, rows: TursoCnpjRow[]) {
  if (rows.length === 0) {
    return;
  }

  const insertSql = `insert into cnpj_establishments (${cnpjColumns.join(", ")}) values (${cnpjColumns.map(() => "?").join(", ")}) on conflict(cnpj) do update set ${mutableColumns.map((column) => `${column} = excluded.${column}`).join(", ")}`;

  await turso.batch(
    rows.map((row) => ({
      args: cnpjColumns.map((column) => toDbValue(row, column)),
      sql: insertSql,
    })),
    "write",
  );
}

async function main() {
  const supabaseUrl = loadRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = loadRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const tursoUrl = loadRequiredEnv("TURSO_DATABASE_URL");
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoToken && !isLocalUrl(tursoUrl)) {
    throw new Error("Defina TURSO_AUTH_TOKEN para bancos Turso remotos.");
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const turso = createTursoClient({ authToken: tursoToken, url: tursoUrl });

  const total = await countSupabaseRows(supabase);
  const startedAt = performance.now();

  console.log(`Total de cnpjs na origem: ${total}`);
  console.log(`Batch de leitura: ${sourceBatchSize}`);
  console.log(`Batch de escrita: ${writeBatchSize}`);

  if (total === 0) {
    console.log("Nenhum registro encontrado em cnpj_establishments.");
    turso.close();
    return;
  }

  let processed = 0;
  let batches = 0;
  let lastCnpj: string | null = null;

  while (processed < total) {
    const sourceRows = await fetchSupabaseBatch(supabase, lastCnpj, sourceBatchSize);

    if (sourceRows.length === 0) {
      break;
    }

    const tursoRows = sourceRows.map(toTursoRow);

    for (const batch of chunk(tursoRows, writeBatchSize)) {
      await upsertBatch(turso, batch);
    }

    processed += sourceRows.length;
    batches += 1;
    lastCnpj = sourceRows[sourceRows.length - 1]?.cnpj ?? lastCnpj;

    const elapsedMs = performance.now() - startedAt;
    const rate = processed / Math.max(elapsedMs / 1000, 1e-6);
    const remaining = Math.max(total - processed, 0);
    const etaMs = rate > 0 ? (remaining / rate) * 1000 : 0;

    console.log(
      `[${processed}/${total}] lote ${batches} | ultimo cnpj ${lastCnpj ?? "-"} | ` +
        `decorrido ${formatDuration(elapsedMs)} | ETA ${formatDuration(etaMs)}`,
    );

    if (sourceRows.length < sourceBatchSize) {
      break;
    }
  }

  turso.close();
  console.log(`Migracao CNPJ finalizada. ${processed} registros processados em ${formatDuration(performance.now() - startedAt)}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
