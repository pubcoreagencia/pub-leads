import { existsSync, readFileSync } from "node:fs";
import { createClient as createTursoClient, type Client, type InValue } from "@libsql/client";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

type SupabaseLeadRow = {
  id: string;
  user_id: string;
  source?: string | null;
  external_id?: string | null;
  name: string;
  company?: string | null;
  business_name?: string | null;
  fantasy_name?: string | null;
  cnpj?: string | null;
  category?: string | null;
  cnae?: string | null;
  cnae_description?: string | null;
  phone?: string | null;
  phone_2?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  metadata?: JsonRecord | null;
  enrichment_source?: string | null;
  enrichment_confidence?: number | string | null;
  raw_cnpj_data?: JsonRecord | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupabaseNoteRow = {
  id: string;
  user_id: string;
  lead_id: string;
  content?: string | null;
  note?: string | null;
  created_at?: string | null;
};

type SupabaseMessageRow = {
  id: string;
  user_id: string;
  lead_id: string;
  content?: string | null;
  message?: string | null;
  metadata?: JsonRecord | null;
  created_at?: string | null;
};

type SupabaseSearchLogRow = {
  id: string;
  user_id: string;
  source?: string | null;
  query?: string | null;
  location?: string | null;
  category?: string | null;
  result_count?: number | null;
  status?: string | null;
  params?: JsonRecord | null;
  created_at?: string | null;
};

const batchSize = 500;

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function isLocalUrl(url: string) {
  return url.startsWith("file:") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value && typeof value === "object" ? value : {});
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function splitLocation(location: string | null | undefined) {
  const [city, state, country] = (location ?? "").split(",").map((item) => clean(item));

  return {
    city: city ?? null,
    country: country ?? null,
    state: state ?? null,
  };
}

async function setupTurso(client: Client) {
  await client.executeMultiple(readFileSync("src/lib/turso/schema.sql", "utf8"));
}

async function migrateLeads(client: Client, supabase: SupabaseClient) {
  let offset = 0;
  let migrated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SupabaseLeadRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const sourcePlaceId = clean(row.external_id) ?? clean(row.cnpj);
      await client.execute({
        args: [
          row.id,
          row.user_id,
          row.name,
          clean(row.business_name) ?? clean(row.company),
          clean(row.fantasy_name),
          clean(row.cnpj),
          clean(row.category),
          clean(row.cnae),
          clean(row.cnae_description),
          clean(row.phone) ?? clean(row.whatsapp),
          clean(row.phone_2),
          clean(row.email),
          clean(row.website),
          clean(row.address),
          clean(row.city),
          clean(row.state),
          clean(row.country),
          toNumber(row.latitude),
          toNumber(row.longitude),
          clean(row.source) ?? "manual",
          sourcePlaceId,
          null,
          null,
          null,
          clean(row.status) ?? clean(row.pipeline_stage) ?? "new",
          0,
          clean(row.enrichment_source),
          toNumber(row.enrichment_confidence),
          stringifyJson(row.metadata),
          row.raw_cnpj_data ? stringifyJson(row.raw_cnpj_data) : null,
          row.created_at ?? new Date().toISOString(),
          row.updated_at ?? row.created_at ?? new Date().toISOString(),
        ] satisfies InValue[],
        sql: `insert or replace into leads (
          id, user_id, name, business_name, fantasy_name, cnpj, category, cnae,
          cnae_description, phone, phone_2, email, website, address, city, state,
          country, latitude, longitude, source, source_place_id, source_url, rating,
          reviews_count, status, score, enrichment_source, enrichment_confidence,
          raw_data, raw_cnpj_data, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      });
      migrated += 1;
    }

    offset += rows.length;
    console.log(`Leads migrados: ${migrated}`);
  }

  return migrated;
}

async function migrateNotes(client: Client, supabase: SupabaseClient) {
  let offset = 0;
  let migrated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("lead_notes")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SupabaseNoteRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      await client.execute({
        args: [
          row.id,
          row.lead_id,
          row.user_id,
          clean(row.content) ?? clean(row.note) ?? "",
          row.created_at ?? new Date().toISOString(),
        ],
        sql: "insert or replace into lead_notes (id, lead_id, user_id, note, created_at) values (?, ?, ?, ?, ?)",
      });
      migrated += 1;
    }

    offset += rows.length;
    console.log(`Notas migradas: ${migrated}`);
  }

  return migrated;
}

async function migrateMessages(client: Client, supabase: SupabaseClient) {
  let offset = 0;
  let migrated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("lead_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SupabaseMessageRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      await client.execute({
        args: [
          row.id,
          row.lead_id,
          row.user_id,
          clean(row.content) ?? clean(row.message) ?? "",
          clean(String(row.metadata?.tone ?? "")),
          clean(String(row.metadata?.objective ?? "")),
          row.created_at ?? new Date().toISOString(),
        ],
        sql: "insert or replace into lead_messages (id, lead_id, user_id, message, tone, objective, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      });
      migrated += 1;
    }

    offset += rows.length;
    console.log(`Mensagens migradas: ${migrated}`);
  }

  return migrated;
}

async function migrateSearchLogs(client: Client, supabase: SupabaseClient) {
  let offset = 0;
  let migrated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("search_logs")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SupabaseSearchLogRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const location = splitLocation(row.location);
      await client.execute({
        args: [
          row.id,
          row.user_id,
          clean(row.query),
          location.city,
          location.state,
          location.country,
          clean(row.category),
          row.result_count ?? 0,
          clean(row.source),
          clean(row.status) ?? "success",
          stringifyJson(row.params),
          row.created_at ?? new Date().toISOString(),
        ],
        sql: "insert or replace into search_logs (id, user_id, query, city, state, country, category, result_count, source, status, raw_params, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      });
      migrated += 1;
    }

    offset += rows.length;
    console.log(`Logs de busca migrados: ${migrated}`);
  }

  return migrated;
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!tursoUrl) {
    throw new Error("Defina TURSO_DATABASE_URL.");
  }

  if (!tursoToken && !isLocalUrl(tursoUrl)) {
    throw new Error("Defina TURSO_AUTH_TOKEN para bancos Turso remotos.");
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const turso = createTursoClient({ authToken: tursoToken, url: tursoUrl });

  await setupTurso(turso);

  const stats = {
    leads: await migrateLeads(turso, supabase),
    leadNotes: await migrateNotes(turso, supabase),
    leadMessages: await migrateMessages(turso, supabase),
    searchLogs: await migrateSearchLogs(turso, supabase),
  };

  turso.close();
  console.log("Migracao Turso finalizada:", stats);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
