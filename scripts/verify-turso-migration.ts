import { existsSync, readFileSync } from "node:fs";
import { createClient as createTursoClient, type Client } from "@libsql/client";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

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

async function countTurso(client: Client, table: string) {
  const result = await client.execute(`select count(*) as total from ${table}`);

  return Number(result.rows[0]?.total ?? 0);
}

async function countSupabase(supabase: SupabaseClient, table: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function compareTable(
  label: string,
  supabase: SupabaseClient,
  turso: Client,
  table: string,
) {
  const [supabaseCount, tursoCount] = await Promise.all([
    countSupabase(supabase, table),
    countTurso(turso, table),
  ]);
  const ok = supabaseCount === tursoCount;

  console.log(`${ok ? "OK" : "DIVERGENTE"} ${label}: Supabase=${supabaseCount} Turso=${tursoCount}`);
  return ok;
}

async function compareLeadsByStatus(supabase: SupabaseClient, turso: Client) {
  const { data, error } = await supabase.from("leads").select("user_id, status");

  if (error) {
    throw error;
  }

  const supabaseCounts = new Map<string, number>();

  for (const row of (data ?? []) as Array<{ user_id: string; status: string | null }>) {
    const key = `${row.user_id}:${row.status ?? "new"}`;
    supabaseCounts.set(key, (supabaseCounts.get(key) ?? 0) + 1);
  }

  const result = await turso.execute(
    "select user_id, status, count(*) as total from leads group by user_id, status",
  );
  const tursoCounts = new Map(
    result.rows.map((row) => [`${String(row.user_id)}:${String(row.status)}`, Number(row.total ?? 0)]),
  );

  const keys = new Set([...supabaseCounts.keys(), ...tursoCounts.keys()]);
  let ok = true;

  for (const key of keys) {
    const left = supabaseCounts.get(key) ?? 0;
    const right = tursoCounts.get(key) ?? 0;

    if (left !== right) {
      ok = false;
      console.log(`DIVERGENTE leads por usuario/status ${key}: Supabase=${left} Turso=${right}`);
    }
  }

  if (ok) {
    console.log("OK leads por usuario/status");
  }

  return ok;
}

async function sampleLeads(supabase: SupabaseClient, turso: Client) {
  const sample = await turso.execute("select id, name from leads order by random() limit 10");
  const ids = sample.rows.map((row) => String(row.id));

  if (ids.length === 0) {
    console.log("Amostra de leads vazia.");
    return true;
  }

  const { data, error } = await supabase.from("leads").select("id, name").in("id", ids);

  if (error) {
    throw error;
  }

  const supabaseNames = new Map(((data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
  let ok = true;

  for (const row of sample.rows) {
    const id = String(row.id);
    const name = String(row.name);

    if (supabaseNames.get(id) !== name) {
      ok = false;
      console.log(`DIVERGENTE amostra lead ${id}: Supabase=${supabaseNames.get(id)} Turso=${name}`);
    }
  }

  if (ok) {
    console.log("OK amostra aleatoria de 10 leads");
  }

  return ok;
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

  const checks = [
    await compareTable("leads", supabase, turso, "leads"),
    await compareTable("lead_notes", supabase, turso, "lead_notes"),
    await compareTable("lead_messages", supabase, turso, "lead_messages"),
    await compareTable("search_logs", supabase, turso, "search_logs"),
    await compareLeadsByStatus(supabase, turso),
    await sampleLeads(supabase, turso),
  ];

  turso.close();

  if (checks.some((ok) => !ok)) {
    throw new Error("Verificacao encontrou divergencias. Nao rode cleanup ainda.");
  }

  console.log("Verificacao Turso concluida sem divergencias.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
