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

type ComparableCnpjRow = {
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

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

const sourceBatchSize = readPositiveInt(process.env.CNPJ_VERIFY_BATCH_SIZE, 1000);
const sampleTarget = 12;

function isLocalUrl(url: string) {
  return url.startsWith("file:") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
}

function loadRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Defina ${name} antes de rodar a verificacao de CNPJ.`);
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
    return null;
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

function normalizeSupabaseRow(row: SupabaseCnpjRow): ComparableCnpjRow {
  const cnpj = cleanText(row.cnpj);
  const uf = cleanText(row.uf)?.toUpperCase();
  const municipio = cleanText(row.municipio);

  if (!cnpj || !uf || !municipio) {
    throw new Error("Linha invalida encontrada na origem Supabase.");
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
    created_at: normalizeTimestamp(row.created_at) ?? "",
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
    updated_at: normalizeTimestamp(row.updated_at) ?? "",
    cep: cleanText(row.cep),
  };
}

function normalizeTursoRow(row: Record<string, unknown>): ComparableCnpjRow {
  return {
    bairro: cleanText(row.bairro),
    cnae_fiscal: cleanText(row.cnae_fiscal),
    cnae_fiscal_descricao: cleanText(row.cnae_fiscal_descricao),
    cnpj: String(row.cnpj ?? ""),
    cnpj_basico: cleanText(row.cnpj_basico),
    cnpj_dv: cleanText(row.cnpj_dv),
    cnpj_ordem: cleanText(row.cnpj_ordem),
    complemento: cleanText(row.complemento),
    created_at: normalizeTimestamp(row.created_at) ?? "",
    data_inicio_atividade: normalizeDate(row.data_inicio_atividade),
    data_situacao_cadastral: normalizeDate(row.data_situacao_cadastral),
    ddd_1: cleanText(row.ddd_1),
    ddd_2: cleanText(row.ddd_2),
    email: cleanText(row.email)?.toLowerCase() ?? null,
    is_headquarters: normalizeBoolean(row.is_headquarters),
    logradouro: cleanText(row.logradouro),
    municipio: String(row.municipio ?? ""),
    nome_fantasia: cleanText(row.nome_fantasia),
    numero: cleanText(row.numero),
    raw_data: normalizeJson(row.raw_data),
    razao_social: cleanText(row.razao_social),
    situacao_cadastral: cleanText(row.situacao_cadastral),
    telefone_1: cleanText(row.telefone_1),
    telefone_2: cleanText(row.telefone_2),
    tipo_logradouro: cleanText(row.tipo_logradouro),
    uf: String(row.uf ?? "").toUpperCase(),
    updated_at: normalizeTimestamp(row.updated_at) ?? "",
    cep: cleanText(row.cep),
  };
}

function compareRows(expected: ComparableCnpjRow, actual: ComparableCnpjRow) {
  const left = JSON.stringify(expected);
  const right = JSON.stringify(actual);

  return left === right;
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

async function countTursoRows(turso: Client) {
  const result = await turso.execute("select count(*) as total from cnpj_establishments");

  return Number(result.rows[0]?.total ?? 0);
}

async function countTursoByUf(turso: Client) {
  const result = await turso.execute(
    "select uf, count(*) as total from cnpj_establishments group by uf order by uf",
  );

  return new Map(
    result.rows.map((row) => [String(row.uf), Number(row.total ?? 0)]),
  );
}

async function fetchTursoBatch(turso: Client, cnpjs: string[]) {
  if (cnpjs.length === 0) {
    return [];
  }

  const placeholders = cnpjs.map(() => "?").join(", ");
  const result = await turso.execute({
    args: cnpjs as InValue[],
    sql: `select cnpj, cnpj_basico, cnpj_ordem, cnpj_dv, is_headquarters, razao_social, nome_fantasia, situacao_cadastral, data_situacao_cadastral, data_inicio_atividade, cnae_fiscal, cnae_fiscal_descricao, tipo_logradouro, logradouro, numero, complemento, bairro, cep, uf, municipio, ddd_1, telefone_1, ddd_2, telefone_2, email, raw_data, created_at, updated_at from cnpj_establishments where cnpj in (${placeholders})`,
  });

  return result.rows;
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

  const startedAt = performance.now();
  const supabaseTotal = await countSupabaseRows(supabase);
  const tursoTotal = await countTursoRows(turso);

  console.log(`Total origem Supabase: ${supabaseTotal}`);
  console.log(`Total destino Turso: ${tursoTotal}`);

  if (supabaseTotal !== tursoTotal) {
    console.warn("Aviso: as contagens iniciais diferem. A verificacao continua para localizar divergencias.");
  }

  const sourceUfCounts = new Map<string, number>();
  const sampleRows: SupabaseCnpjRow[] = [];
  const sampleCnpjs = new Set<string>();
  let processed = 0;
  let batches = 0;
  let lastCnpj: string | null = null;
  let missingCount = 0;
  const missingExamples: string[] = [];

  while (processed < supabaseTotal) {
    const sourceRows = await fetchSupabaseBatch(supabase, lastCnpj, sourceBatchSize);

    if (sourceRows.length === 0) {
      break;
    }

    const cnpjs = sourceRows.map((row) => row.cnpj);
    const tursoRows = await fetchTursoBatch(turso, cnpjs);
    const tursoMap = new Map(tursoRows.map((row) => [String(row.cnpj), normalizeTursoRow(row)]));

    for (const row of sourceRows) {
      sourceUfCounts.set(row.uf.toUpperCase(), (sourceUfCounts.get(row.uf.toUpperCase()) ?? 0) + 1);

      if (sampleRows.length < sampleTarget && !sampleCnpjs.has(row.cnpj)) {
        sampleRows.push(row);
        sampleCnpjs.add(row.cnpj);
      }

      const tursoRow = tursoMap.get(row.cnpj);

      if (!tursoRow) {
        missingCount += 1;
        if (missingExamples.length < 20) {
          missingExamples.push(row.cnpj);
        }
        continue;
      }

      if (!compareRows(normalizeSupabaseRow(row), tursoRow)) {
        throw new Error(`Divergencia de dados para o CNPJ ${row.cnpj}.`);
      }
    }

    processed += sourceRows.length;
    batches += 1;
    lastCnpj = sourceRows[sourceRows.length - 1]?.cnpj ?? lastCnpj;

    const elapsedMs = performance.now() - startedAt;
    const rate = processed / Math.max(elapsedMs / 1000, 1e-6);
    const remaining = Math.max(supabaseTotal - processed, 0);
    const etaMs = rate > 0 ? (remaining / rate) * 1000 : 0;

    console.log(
      `[${processed}/${supabaseTotal}] lote ${batches} | ultimo cnpj ${lastCnpj ?? "-"} | ` +
        `faltantes acumulados ${missingCount} | decorrido ${formatDuration(elapsedMs)} | ETA ${formatDuration(etaMs)}`,
    );

    if (sourceRows.length < sourceBatchSize) {
      break;
    }
  }

  if (missingCount > 0) {
    throw new Error(
      `Existem ${missingCount} CNPJs ausentes no Turso. Exemplos: ${missingExamples.join(", ")}`,
    );
  }

  const tursoUfCounts = await countTursoByUf(turso);

  for (const [uf, sourceCount] of sourceUfCounts.entries()) {
    const tursoCount = tursoUfCounts.get(uf) ?? 0;

    if (sourceCount !== tursoCount) {
      throw new Error(`Divergencia por UF ${uf}: Supabase=${sourceCount} Turso=${tursoCount}`);
    }
  }

  for (const [uf, tursoCount] of tursoUfCounts.entries()) {
    const sourceCount = sourceUfCounts.get(uf) ?? 0;

    if (sourceCount !== tursoCount) {
      throw new Error(`Divergencia por UF ${uf}: Supabase=${sourceCount} Turso=${tursoCount}`);
    }
  }

  if (sampleRows.length > 0) {
    const sampleTursoRows = await fetchTursoBatch(
      turso,
      sampleRows.map((row) => row.cnpj),
    );
    const sampleTursoMap = new Map(sampleTursoRows.map((row) => [String(row.cnpj), normalizeTursoRow(row)]));

    for (const row of sampleRows) {
      const tursoRow = sampleTursoMap.get(row.cnpj);

      if (!tursoRow) {
        throw new Error(`Amostra nao encontrada no Turso para o CNPJ ${row.cnpj}.`);
      }

      if (!compareRows(normalizeSupabaseRow(row), tursoRow)) {
        throw new Error(`Amostra divergente para o CNPJ ${row.cnpj}.`);
      }
    }
  }

  if (supabaseTotal !== tursoTotal) {
    throw new Error(`Contagem total divergente: Supabase=${supabaseTotal} Turso=${tursoTotal}`);
  }

  turso.close();
  console.log(`Verificacao CNPJ concluida sem divergencias em ${formatDuration(performance.now() - startedAt)}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
