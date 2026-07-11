import type { Row } from "@libsql/client";

import type { ApifySourceDefinition } from "@/src/lib/apify/types";
import { getTursoClient } from "@/src/lib/turso/client";
import { parseJsonRecord, stringifyJson } from "@/src/lib/turso/mappers";

let ensureApifySourcesSchemaPromise: Promise<void> | null = null;

function valueOf(row: Row | Record<string, unknown>, key: string) {
  return row[key] as unknown;
}

function bool(value: unknown) {
  return Number(value ?? 0) === 1;
}

export function ensureApifySourcesSchema() {
  ensureApifySourcesSchemaPromise ??= getTursoClient().executeMultiple(`
    create table if not exists apify_sources (
      id text primary key,
      user_id text,
      kind text not null,
      actor_id text,
      task_id text,
      name text not null,
      description text,
      category text not null,
      lead_mapping text not null,
      is_enabled integer not null default 1,
      is_recommended integer not null default 0,
      input_schema text,
      default_input text,
      metadata text not null default '{}',
      synced_at text not null,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    );
    create index if not exists apify_sources_user_category_idx on apify_sources(user_id, category);
    create index if not exists apify_sources_user_kind_idx on apify_sources(user_id, kind);
    create trigger if not exists apify_sources_set_updated_at
    after update on apify_sources
    for each row
    when new.updated_at = old.updated_at
    begin
      update apify_sources set updated_at = current_timestamp where id = old.id;
    end;
  `).then(() => undefined);

  return ensureApifySourcesSchemaPromise;
}

function rowToSource(row: Row | Record<string, unknown>): ApifySourceDefinition {
  return {
    actorId: typeof valueOf(row, "actor_id") === "string" ? String(valueOf(row, "actor_id")) : null,
    category: String(valueOf(row, "category")) as ApifySourceDefinition["category"],
    defaultInput: parseJsonRecord(valueOf(row, "default_input")),
    description: typeof valueOf(row, "description") === "string" ? String(valueOf(row, "description")) : null,
    enabled: bool(valueOf(row, "is_enabled")),
    estimatedCostLabel: typeof parseJsonRecord(valueOf(row, "metadata")).estimatedCostLabel === "string"
      ? String(parseJsonRecord(valueOf(row, "metadata")).estimatedCostLabel)
      : "Medio",
    id: String(valueOf(row, "id")),
    inputSchema: parseJsonRecord(valueOf(row, "input_schema")),
    isRecommended: bool(valueOf(row, "is_recommended")),
    kind: String(valueOf(row, "kind")) as ApifySourceDefinition["kind"],
    leadMapping: String(valueOf(row, "lead_mapping")) as ApifySourceDefinition["leadMapping"],
    metadata: parseJsonRecord(valueOf(row, "metadata")),
    name: String(valueOf(row, "name")),
    requiresInput: bool(parseJsonRecord(valueOf(row, "metadata")).requiresInput),
    supportedUse: typeof parseJsonRecord(valueOf(row, "metadata")).supportedUse === "string"
      ? String(parseJsonRecord(valueOf(row, "metadata")).supportedUse)
      : "Executar fonte Apify",
    taskId: typeof valueOf(row, "task_id") === "string" ? String(valueOf(row, "task_id")) : null,
  };
}

export async function listCachedApifySources(userId: string) {
  await ensureApifySourcesSchema();
  const result = await getTursoClient().execute({
    args: [userId],
    sql: "select * from apify_sources where user_id = ? order by is_recommended desc, kind desc, name asc",
  });

  return result.rows.map(rowToSource);
}

export async function upsertCachedApifySources(userId: string, sources: ApifySourceDefinition[]) {
  await ensureApifySourcesSchema();
  const now = new Date().toISOString();

  for (const source of sources) {
    const metadata = {
      ...(source.metadata ?? {}),
      estimatedCostLabel: source.estimatedCostLabel,
      requiresInput: source.requiresInput,
      supportedUse: source.supportedUse,
    };

    await getTursoClient().execute({
      args: [
        source.id,
        userId,
        source.kind,
        source.actorId,
        source.taskId,
        source.name,
        source.description,
        source.category,
        source.leadMapping,
        source.enabled ? 1 : 0,
        source.isRecommended ? 1 : 0,
        stringifyJson(source.inputSchema ?? {}),
        stringifyJson(source.defaultInput ?? {}),
        stringifyJson(metadata),
        now,
        now,
      ],
      sql: `insert into apify_sources (id,user_id,kind,actor_id,task_id,name,description,category,lead_mapping,is_enabled,is_recommended,input_schema,default_input,metadata,synced_at)
        values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        on conflict(id) do update set
          actor_id = excluded.actor_id,
          task_id = excluded.task_id,
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          lead_mapping = excluded.lead_mapping,
          is_enabled = excluded.is_enabled,
          is_recommended = excluded.is_recommended,
          input_schema = excluded.input_schema,
          default_input = excluded.default_input,
          metadata = excluded.metadata,
          synced_at = excluded.synced_at,
          updated_at = ?`,
    });
  }
}
