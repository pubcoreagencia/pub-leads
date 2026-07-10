import type { InValue, Row } from "@libsql/client";

import {
  getLeadQualification,
  qualifyLeadAfterScraping,
  type LeadQualification,
} from "@/src/lib/lead-qualification/qualifier";
import type { LeadSourceId, NormalizedLead } from "@/src/lib/lead-sources/types";
import type {
  ScrapingSession,
  ScrapingSessionLead,
  ScrapingSessionWithResults,
} from "@/src/lib/scraping-sessions/types";
import { getTursoClient } from "@/src/lib/turso/client";
import { parseJsonRecord, stringifyJson } from "@/src/lib/turso/mappers";
import { createManyLeads, findDuplicateLead } from "@/src/lib/turso/leads-repository";
import type {
  JsonRecord,
  LeadWriteInput,
  ScrapingSessionResultRow,
  ScrapingSessionStatus,
} from "@/src/lib/turso/types";

export type ScrapingSessionCreateInput = {
  city?: string | null;
  expires_at?: string | null;
  filters?: JsonRecord | null;
  metadata?: JsonRecord | null;
  niche?: string | null;
  query?: string | null;
  requested_limit?: number | null;
  source: string;
  status?: ScrapingSessionStatus;
};

export type ScrapingSessionUpdateInput = Partial<{
  apify_dataset_id: string | null;
  apify_run_id: string | null;
  city: string | null;
  error_message: string | null;
  expires_at: string | null;
  filters: JsonRecord | null;
  metadata: JsonRecord | null;
  niche: string | null;
  query: string | null;
  requested_limit: number | null;
  results_count: number;
  selected_count: number;
  source_run_id: string | null;
  status: ScrapingSessionStatus;
}>;

export type SaveSessionLeadsResult = {
  savedExternalIds: string[];
  savedResultIds: string[];
  skippedExternalIds: string[];
  skippedResultIds: string[];
};

const sessionColumns = [
  "id",
  "user_id",
  "source",
  "status",
  "city",
  "niche",
  "query",
  "requested_limit",
  "results_count",
  "selected_count",
  "filters",
  "source_run_id",
  "apify_run_id",
  "apify_dataset_id",
  "error_message",
  "metadata",
  "created_at",
  "updated_at",
  "expires_at",
] as const;

const resultColumns = [
  "id",
  "session_id",
  "user_id",
  "external_id",
  "source",
  "name",
  "company",
  "category",
  "phone",
  "whatsapp",
  "email",
  "website",
  "instagram_url",
  "instagram_handle",
  "address",
  "city",
  "state",
  "country",
  "latitude",
  "longitude",
  "status",
  "phone_type",
  "whatsapp_status",
  "instagram_status",
  "qualification_tags",
  "qualification_score",
  "metadata",
  "is_selected",
  "is_saved",
  "saved_lead_id",
  "created_at",
  "updated_at",
] as const;

let ensureScrapingSessionSchemaPromise: Promise<void> | null = null;

function ensureScrapingSessionSchema() {
  ensureScrapingSessionSchemaPromise ??= getTursoClient().executeMultiple(`
    pragma foreign_keys = on;

    create table if not exists scraping_sessions (
      id text primary key,
      user_id text not null,
      source text not null,
      status text not null default 'idle',
      city text,
      niche text,
      query text,
      requested_limit integer,
      results_count integer not null default 0,
      selected_count integer not null default 0,
      filters text,
      source_run_id text,
      apify_run_id text,
      apify_dataset_id text,
      error_message text,
      metadata text not null default '{}',
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp,
      expires_at text
    );

    create table if not exists scraping_session_results (
      id text primary key,
      session_id text not null references scraping_sessions(id) on delete cascade,
      user_id text not null,
      external_id text,
      source text not null,
      name text not null,
      company text,
      category text,
      phone text,
      whatsapp text,
      email text,
      website text,
      instagram_url text,
      instagram_handle text,
      address text,
      city text,
      state text,
      country text,
      latitude real,
      longitude real,
      status text,
      phone_type text,
      whatsapp_status text,
      instagram_status text,
      qualification_tags text,
      qualification_score integer,
      metadata text not null default '{}',
      is_selected integer not null default 0,
      is_saved integer not null default 0,
      saved_lead_id text,
      created_at text not null default current_timestamp,
      updated_at text not null default current_timestamp
    );

    create index if not exists scraping_sessions_user_updated_idx on scraping_sessions(user_id, updated_at);
    create index if not exists scraping_sessions_user_status_idx on scraping_sessions(user_id, status);
    create index if not exists scraping_session_results_session_idx on scraping_session_results(session_id);
    create index if not exists scraping_session_results_user_session_idx on scraping_session_results(user_id, session_id);
    create index if not exists scraping_session_results_user_saved_idx on scraping_session_results(user_id, is_saved);
    create unique index if not exists scraping_session_results_session_external_unique_idx
      on scraping_session_results(session_id, external_id)
      where external_id is not null and external_id <> '';

    create trigger if not exists scraping_sessions_set_updated_at
    after update on scraping_sessions
    for each row
    when new.updated_at = old.updated_at
    begin
      update scraping_sessions set updated_at = current_timestamp where id = old.id;
    end;

    create trigger if not exists scraping_session_results_set_updated_at
    after update on scraping_session_results
    for each row
    when new.updated_at = old.updated_at
    begin
      update scraping_session_results set updated_at = current_timestamp where id = old.id;
    end;
  `).then(() => undefined);

  return ensureScrapingSessionSchemaPromise;
}

function cleanString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function rowValue(row: Row | Record<string, unknown>, key: string) {
  return row[key] as unknown;
}

function rowToSession(row: Row | Record<string, unknown>): ScrapingSession {
  return {
    apify_dataset_id: cleanString(String(rowValue(row, "apify_dataset_id") ?? "")),
    apify_run_id: cleanString(String(rowValue(row, "apify_run_id") ?? "")),
    city: cleanString(String(rowValue(row, "city") ?? "")),
    created_at: String(rowValue(row, "created_at")),
    error_message: cleanString(String(rowValue(row, "error_message") ?? "")),
    expires_at: cleanString(String(rowValue(row, "expires_at") ?? "")),
    filters: parseJsonRecord(rowValue(row, "filters")),
    id: String(rowValue(row, "id")),
    metadata: parseJsonRecord(rowValue(row, "metadata")),
    niche: cleanString(String(rowValue(row, "niche") ?? "")),
    query: cleanString(String(rowValue(row, "query") ?? "")),
    requested_limit:
      typeof rowValue(row, "requested_limit") === "number"
        ? Number(rowValue(row, "requested_limit"))
        : rowValue(row, "requested_limit") === null
          ? null
          : Number(rowValue(row, "requested_limit") ?? 0) || null,
    results_count: Number(rowValue(row, "results_count") ?? 0),
    selected_count: Number(rowValue(row, "selected_count") ?? 0),
    source: String(rowValue(row, "source")),
    source_run_id: cleanString(String(rowValue(row, "source_run_id") ?? "")),
    status: String(rowValue(row, "status") ?? "idle") as ScrapingSessionStatus,
    updated_at: String(rowValue(row, "updated_at")),
    user_id: String(rowValue(row, "user_id")),
  };
}

function rowToResult(row: Row | Record<string, unknown>): ScrapingSessionResultRow {
  return {
    address: cleanString(String(rowValue(row, "address") ?? "")),
    category: cleanString(String(rowValue(row, "category") ?? "")),
    city: cleanString(String(rowValue(row, "city") ?? "")),
    company: cleanString(String(rowValue(row, "company") ?? "")),
    country: cleanString(String(rowValue(row, "country") ?? "")),
    created_at: String(rowValue(row, "created_at")),
    email: cleanString(String(rowValue(row, "email") ?? "")),
    external_id: cleanString(String(rowValue(row, "external_id") ?? "")),
    id: String(rowValue(row, "id")),
    instagram_handle: cleanString(String(rowValue(row, "instagram_handle") ?? "")),
    instagram_status: cleanString(String(rowValue(row, "instagram_status") ?? "")),
    instagram_url: cleanString(String(rowValue(row, "instagram_url") ?? "")),
    is_saved: Number(rowValue(row, "is_saved") ?? 0),
    is_selected: Number(rowValue(row, "is_selected") ?? 0),
    latitude: typeof rowValue(row, "latitude") === "number" ? Number(rowValue(row, "latitude")) : null,
    longitude: typeof rowValue(row, "longitude") === "number" ? Number(rowValue(row, "longitude")) : null,
    metadata: String(rowValue(row, "metadata") ?? "{}"),
    name: String(rowValue(row, "name")),
    phone: cleanString(String(rowValue(row, "phone") ?? "")),
    phone_type: cleanString(String(rowValue(row, "phone_type") ?? "")),
    qualification_score:
      typeof rowValue(row, "qualification_score") === "number"
        ? Number(rowValue(row, "qualification_score"))
        : null,
    qualification_tags: cleanString(String(rowValue(row, "qualification_tags") ?? "")),
    saved_lead_id: cleanString(String(rowValue(row, "saved_lead_id") ?? "")),
    session_id: String(rowValue(row, "session_id")),
    source: String(rowValue(row, "source") ?? "openstreetmap") as LeadSourceId,
    state: cleanString(String(rowValue(row, "state") ?? "")),
    status: cleanString(String(rowValue(row, "status") ?? "")),
    updated_at: String(rowValue(row, "updated_at")),
    user_id: String(rowValue(row, "user_id")),
    website: cleanString(String(rowValue(row, "website") ?? "")),
    whatsapp: cleanString(String(rowValue(row, "whatsapp") ?? "")),
    whatsapp_status: cleanString(String(rowValue(row, "whatsapp_status") ?? "")),
  };
}

function qualificationFromRow(row: ScrapingSessionResultRow, metadata: JsonRecord): LeadQualification | undefined {
  const existing = metadata.qualification;

  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return existing as LeadQualification;
  }

  if (!row.whatsapp_status && !row.instagram_status) {
    return undefined;
  }

  return {
    instagram_checked_at: null,
    instagram_handle: row.instagram_handle,
    instagram_status: (row.instagram_status ?? "unknown") as LeadQualification["instagram_status"],
    instagram_url: row.instagram_url,
    normalized_phone: null,
    normalized_whatsapp: row.whatsapp ?? null,
    phone_type: (row.phone_type ?? "unknown") as LeadQualification["phone_type"],
    qualification_score: row.qualification_score ?? 0,
    qualification_tags: row.qualification_tags ? JSON.parse(row.qualification_tags) as LeadQualification["qualification_tags"] : [],
    whatsapp_checked_at: new Date().toISOString(),
    whatsapp_confidence: 0,
    whatsapp_status: (row.whatsapp_status ?? "unknown") as LeadQualification["whatsapp_status"],
    whatsapp_validation_source: "none",
  };
}

function resultRowToLead(row: ScrapingSessionResultRow): ScrapingSessionLead {
  const metadata = parseJsonRecord(row.metadata);
  const sourcePlaceId = row.external_id ?? row.id;
  const baseLead = {
    address: row.address,
    businessName: row.company,
    category: row.category ?? "outros",
    city: row.city ?? "",
    cnae: typeof metadata.cnae === "string" ? metadata.cnae : null,
    cnaeDescription: typeof metadata.cnaeDescription === "string" ? metadata.cnaeDescription : null,
    cnpj: typeof metadata.cnpj === "string" ? metadata.cnpj : null,
    country: row.country ?? "Brasil",
    email: row.email,
    externalId: sourcePlaceId,
    fantasyName: typeof metadata.fantasyName === "string" ? metadata.fantasyName : null,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    phone: row.phone,
    phone2: typeof metadata.phone2 === "string" ? metadata.phone2 : null,
    qualification: qualificationFromRow(row, metadata),
    rawData: metadata,
    rating: typeof metadata.rating === "number" ? metadata.rating : null,
    reviewsCount: typeof metadata.reviewsCount === "number" ? metadata.reviewsCount : null,
    saved: row.is_saved === 1,
    savedLeadId: row.saved_lead_id,
    selected: row.is_selected === 1,
    sessionResultId: row.id,
    source: row.source,
    sourcePlaceId,
    sourceUrl: typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : null,
    state: row.state ?? "",
    website: row.website,
  } satisfies ScrapingSessionLead;

  return baseLead.qualification
    ? baseLead
    : { ...baseLead, qualification: qualifyLeadAfterScraping(baseLead).qualification };
}

function getExternalId(lead: NormalizedLead & { externalId?: string }) {
  return lead.externalId ?? lead.sourcePlaceId ?? lead.cnpj ?? lead.name;
}

function resultToLeadInput(result: ScrapingSessionLead): LeadWriteInput {
  const qualified = qualifyLeadAfterScraping({
    ...result,
    rawData: result.qualification
      ? { ...result.rawData, qualification: result.qualification }
      : result.rawData,
  });

  return {
    address: result.address ?? null,
    business_name: result.businessName ?? null,
    category: result.category,
    city: result.city,
    cnae: result.cnae ?? null,
    cnae_description: result.cnaeDescription ?? null,
    cnpj: result.cnpj ?? null,
    country: result.country,
    email: result.email ?? null,
    enrichment_source: result.source === "cnpj_brasil" ? "cnpj_brasil" : null,
    fantasy_name: result.fantasyName ?? null,
    latitude: result.latitude ?? null,
    longitude: result.longitude ?? null,
    name: result.name,
    phone: result.phone ?? null,
    phone_2: result.phone2 ?? null,
    rating: result.rating ?? null,
    raw_cnpj_data: result.source === "cnpj_brasil" ? qualified.rawData : null,
    raw_data: qualified.rawData,
    reviews_count: result.reviewsCount ?? null,
    source: result.source,
    source_place_id: result.externalId ?? result.sourcePlaceId,
    source_url: result.sourceUrl ?? null,
    state: result.state,
    status: "new",
    website: result.website ?? null,
  };
}

async function refreshSessionCounts(userId: string, sessionId: string) {
  await ensureScrapingSessionSchema();

  const result = await getTursoClient().execute({
    args: [userId, sessionId],
    sql: "select count(*) as results_count, coalesce(sum(is_selected), 0) as selected_count from scraping_session_results where user_id = ? and session_id = ?",
  });
  const row = result.rows[0];
  const resultsCount = Number(row?.results_count ?? 0);
  const selectedCount = Number(row?.selected_count ?? 0);

  await updateScrapingSession(userId, sessionId, {
    results_count: resultsCount,
    selected_count: selectedCount,
  });
}

export async function createScrapingSession(userId: string, input: ScrapingSessionCreateInput) {
  await ensureScrapingSessionSchema();

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await getTursoClient().execute({
    args: [
      id,
      userId,
      input.source,
      input.status ?? "idle",
      cleanString(input.city),
      cleanString(input.niche),
      cleanString(input.query),
      input.requested_limit ?? null,
      stringifyJson(input.filters ?? {}),
      stringifyJson(input.metadata ?? {}),
      now,
      now,
      input.expires_at ?? null,
    ],
    sql: "insert into scraping_sessions (id,user_id,source,status,city,niche,query,requested_limit,filters,metadata,created_at,updated_at,expires_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  });

  return getScrapingSession(userId, id);
}

export async function getScrapingSession(userId: string, sessionId: string) {
  await ensureScrapingSessionSchema();

  const row = (await getTursoClient().execute({
    args: [userId, sessionId],
    sql: `select ${sessionColumns.join(", ")} from scraping_sessions where user_id = ? and id = ? limit 1`,
  })).rows[0];

  return row ? rowToSession(row) : null;
}

export async function getCurrentScrapingSession(userId: string): Promise<ScrapingSessionWithResults | null> {
  await ensureScrapingSessionSchema();

  const row = (await getTursoClient().execute({
    args: [userId],
    sql: `select ${sessionColumns.join(", ")} from scraping_sessions where user_id = ? and status != 'cancelled' order by datetime(updated_at) desc limit 1`,
  })).rows[0];

  if (!row) {
    return null;
  }

  const session = rowToSession(row);
  const results = await listScrapingSessionResults(userId, session.id);
  return { results, session };
}

export async function getScrapingSessionWithResults(userId: string, sessionId: string): Promise<ScrapingSessionWithResults | null> {
  await ensureScrapingSessionSchema();

  const session = await getScrapingSession(userId, sessionId);

  if (!session) {
    return null;
  }

  const results = await listScrapingSessionResults(userId, sessionId);
  return { results, session };
}

export async function updateScrapingSession(userId: string, sessionId: string, data: ScrapingSessionUpdateInput) {
  await ensureScrapingSessionSchema();

  const entries = Object.entries(data).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return getScrapingSession(userId, sessionId);
  }

  const args: InValue[] = entries.map(([key, value]) => {
    if (key === "filters" || key === "metadata") {
      return stringifyJson(value as JsonRecord | null | undefined);
    }

    return (value ?? null) as InValue;
  });

  args.push(new Date().toISOString(), userId, sessionId);

  await getTursoClient().execute({
    args,
    sql: `update scraping_sessions set ${entries.map(([key]) => `${key} = ?`).join(", ")}, updated_at = ? where user_id = ? and id = ?`,
  });

  return getScrapingSession(userId, sessionId);
}

export async function deleteScrapingSession(userId: string, sessionId: string) {
  await ensureScrapingSessionSchema();

  const result = await getTursoClient().execute({
    args: [userId, sessionId],
    sql: "delete from scraping_sessions where user_id = ? and id = ?",
  });

  return Number(result.rowsAffected ?? 0) > 0;
}

export async function listScrapingSessionResults(userId: string, sessionId: string, limit = 500) {
  await ensureScrapingSessionSchema();

  const result = await getTursoClient().execute({
    args: [userId, sessionId, Math.min(Math.max(Math.trunc(limit), 1), 1000)],
    sql: `select ${resultColumns.join(", ")} from scraping_session_results where user_id = ? and session_id = ? order by datetime(created_at) asc limit ?`,
  });

  return result.rows.map((row) => resultRowToLead(rowToResult(row)));
}

export async function upsertScrapingSessionResults(
  userId: string,
  sessionId: string,
  leads: Array<NormalizedLead & { externalId?: string; saved?: boolean; selected?: boolean; whatsapp?: string | null }>,
) {
  await ensureScrapingSessionSchema();

  const session = await getScrapingSession(userId, sessionId);

  if (!session) {
    return [];
  }

  const now = new Date().toISOString();
  const inserted: ScrapingSessionLead[] = [];

  for (const lead of leads.slice(0, 1000)) {
    const qualified = qualifyLeadAfterScraping({
      ...lead,
      rawData: lead.qualification
        ? { ...lead.rawData, qualification: lead.qualification }
        : lead.rawData,
    });
    const qualification = getLeadQualification(qualified);
    const metadata = {
      ...qualified.rawData,
      cnae: lead.cnae,
      cnaeDescription: lead.cnaeDescription,
      cnpj: lead.cnpj,
      fantasyName: lead.fantasyName,
      phone2: lead.phone2,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
      sourceUrl: lead.sourceUrl,
    };
    const externalId = getExternalId(lead);
    const id = crypto.randomUUID();

    await getTursoClient().execute({
      args: [
        id,
        sessionId,
        userId,
        externalId,
        lead.source,
        lead.name,
        lead.businessName ?? lead.fantasyName ?? null,
        lead.category,
        lead.phone ?? null,
        lead.whatsapp ?? qualification.normalized_whatsapp ?? null,
        lead.email ?? null,
        lead.website ?? null,
        qualification.instagram_url,
        qualification.instagram_handle,
        lead.address ?? null,
        lead.city,
        lead.state,
        lead.country,
        lead.latitude ?? null,
        lead.longitude ?? null,
        "new",
        qualification.phone_type,
        qualification.whatsapp_status,
        qualification.instagram_status,
        JSON.stringify(qualification.qualification_tags),
        qualification.qualification_score,
        stringifyJson(metadata),
        lead.selected ? 1 : 0,
        lead.saved ? 1 : 0,
        null,
        now,
        now,
      ],
      sql: `insert into scraping_session_results (${resultColumns.join(", ")}) values (${resultColumns.map(() => "?").join(", ")})
        on conflict(session_id, external_id) where external_id is not null and external_id <> '' do update set
          source = excluded.source,
          name = excluded.name,
          company = excluded.company,
          category = excluded.category,
          phone = excluded.phone,
          whatsapp = excluded.whatsapp,
          email = excluded.email,
          website = excluded.website,
          instagram_url = excluded.instagram_url,
          instagram_handle = excluded.instagram_handle,
          address = excluded.address,
          city = excluded.city,
          state = excluded.state,
          country = excluded.country,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          status = excluded.status,
          phone_type = excluded.phone_type,
          whatsapp_status = excluded.whatsapp_status,
          instagram_status = excluded.instagram_status,
          qualification_tags = excluded.qualification_tags,
          qualification_score = excluded.qualification_score,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at`,
    });
  }

  await refreshSessionCounts(userId, sessionId);
  inserted.push(...await listScrapingSessionResults(userId, sessionId));
  return inserted;
}

export async function updateScrapingSessionResultSelection(userId: string, sessionId: string, resultIds: string[], selected: boolean) {
  await ensureScrapingSessionSchema();

  const ids = Array.from(new Set(resultIds.map(cleanString).filter(Boolean)));

  if (ids.length === 0) {
    return getScrapingSessionWithResults(userId, sessionId);
  }

  const placeholders = ids.map(() => "?").join(", ");
  await getTursoClient().execute({
    args: [selected ? 1 : 0, new Date().toISOString(), userId, sessionId, ...ids],
    sql: `update scraping_session_results set is_selected = ?, updated_at = ? where user_id = ? and session_id = ? and id in (${placeholders})`,
  });

  await refreshSessionCounts(userId, sessionId);
  return getScrapingSessionWithResults(userId, sessionId);
}

export async function updateScrapingSessionResultLeads(
  userId: string,
  sessionId: string,
  leads: Array<NormalizedLead & { externalId?: string; saved?: boolean; selected?: boolean; whatsapp?: string | null }>,
) {
  await ensureScrapingSessionSchema();

  for (const lead of leads.slice(0, 1000)) {
    await upsertScrapingSessionResults(userId, sessionId, [lead]);
  }

  return getScrapingSessionWithResults(userId, sessionId);
}

export async function saveScrapingSessionResultsAsLeads(
  userId: string,
  sessionId: string,
  resultIds: string[],
): Promise<SaveSessionLeadsResult> {
  await ensureScrapingSessionSchema();

  const ids = Array.from(new Set(resultIds.map(cleanString).filter(Boolean))).slice(0, 100);
  const allResults = await listScrapingSessionResults(userId, sessionId, 1000);
  const selectedResults = ids.length > 0
    ? allResults.filter((result) => ids.includes(result.sessionResultId))
    : allResults.filter((result) => result.selected);
  const pendingResults = selectedResults.filter((result) => !result.saved);
  const savedExternalIds: string[] = [];
  const savedResultIds: string[] = [];
  const skippedExternalIds: string[] = [];
  const skippedResultIds: string[] = [];
  const leadsToInsert: Array<{ input: LeadWriteInput; result: ScrapingSessionLead }> = [];

  for (const result of pendingResults) {
    const input = resultToLeadInput(result);
    const duplicate = await findDuplicateLead(userId, input);

    if (duplicate) {
      skippedExternalIds.push(result.externalId);
      skippedResultIds.push(result.sessionResultId);
      await markResultSaved(userId, sessionId, result.sessionResultId, duplicate.id);
      continue;
    }

    leadsToInsert.push({ input, result });
  }

  if (leadsToInsert.length > 0) {
    const created = await createManyLeads(userId, leadsToInsert.map((item) => item.input));

    for (const lead of created.created) {
      const match = leadsToInsert.find((item) => item.input.source_place_id === lead.external_id);

      if (!match) {
        continue;
      }

      savedExternalIds.push(match.result.externalId);
      savedResultIds.push(match.result.sessionResultId);
      await markResultSaved(userId, sessionId, match.result.sessionResultId, lead.id);
    }

    for (const skipped of created.skipped) {
      const match = leadsToInsert.find((item) => item.input.source_place_id === skipped.external_id);

      if (!match) {
        continue;
      }

      skippedExternalIds.push(match.result.externalId);
      skippedResultIds.push(match.result.sessionResultId);
      await markResultSaved(userId, sessionId, match.result.sessionResultId, skipped.id);
    }
  }

  await refreshSessionCounts(userId, sessionId);

  return {
    savedExternalIds,
    savedResultIds,
    skippedExternalIds,
    skippedResultIds,
  };
}

async function markResultSaved(userId: string, sessionId: string, resultId: string, leadId: string | null) {
  await getTursoClient().execute({
    args: [leadId, new Date().toISOString(), userId, sessionId, resultId],
    sql: "update scraping_session_results set is_saved = 1, is_selected = 0, saved_lead_id = ?, updated_at = ? where user_id = ? and session_id = ? and id = ?",
  });
}
