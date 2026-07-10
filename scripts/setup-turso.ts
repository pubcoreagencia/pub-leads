import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";

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

async function ensureLeadQualificationColumns(client: ReturnType<typeof createClient>) {
  const columns = await client.execute("pragma table_info(leads)");
  const existing = new Set(columns.rows.map((row) => String(row.name)));
  const additions = [
    ["whatsapp", "text"],
    ["phone_type", "text not null default 'unknown'"],
    ["normalized_phone", "text"],
    ["normalized_whatsapp", "text"],
    ["whatsapp_status", "text not null default 'unknown'"],
    ["whatsapp_confidence", "integer"],
    ["whatsapp_validation_source", "text"],
    ["whatsapp_checked_at", "text"],
    ["qualification_tags", "text"],
  ] as const;

  for (const [name, definition] of additions) {
    if (!existing.has(name)) {
      await client.execute(`alter table leads add column ${name} ${definition}`);
    }
  }

  await client.execute("create index if not exists leads_user_whatsapp_status_idx on leads(user_id, whatsapp_status)");
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("Defina TURSO_DATABASE_URL antes de rodar o setup.");
  }

  if (!authToken && !isLocalUrl(url)) {
    throw new Error("Defina TURSO_AUTH_TOKEN para bancos remotos.");
  }

  const schemaPath = resolve("src/lib/turso/schema.sql");
  const schema = readFileSync(schemaPath, "utf8");
  const client = createClient({ authToken, url });

  await client.executeMultiple(schema);
  await ensureLeadQualificationColumns(client);
  client.close();

  console.log(`Schema Turso aplicado com sucesso: ${schemaPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
