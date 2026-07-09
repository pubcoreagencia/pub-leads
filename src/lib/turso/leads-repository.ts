import type { InValue } from "@libsql/client";

import type { Lead, LeadSource, LeadStatus } from "@/schemas/lead";
import { getTursoClient } from "@/src/lib/turso/client";
import { rowToLead, rowToTursoLead, stringifyJson } from "@/src/lib/turso/mappers";
import type {
  CountPoint,
  CreateManyLeadsResult,
  LeadListFilters,
  LeadUpdateInput,
  LeadWriteInput,
} from "@/src/lib/turso/types";

const leadColumns = [
  "id",
  "user_id",
  "name",
  "business_name",
  "fantasy_name",
  "cnpj",
  "category",
  "cnae",
  "cnae_description",
  "phone",
  "phone_2",
  "email",
  "website",
  "address",
  "city",
  "state",
  "country",
  "latitude",
  "longitude",
  "source",
  "source_place_id",
  "source_url",
  "rating",
  "reviews_count",
  "status",
  "score",
  "enrichment_source",
  "enrichment_confidence",
  "raw_data",
  "raw_cnpj_data",
  "created_at",
  "updated_at",
] as const;

const mutableColumns = [
  "name",
  "business_name",
  "fantasy_name",
  "cnpj",
  "category",
  "cnae",
  "cnae_description",
  "phone",
  "phone_2",
  "email",
  "website",
  "address",
  "city",
  "state",
  "country",
  "latitude",
  "longitude",
  "source",
  "source_place_id",
  "source_url",
  "rating",
  "reviews_count",
  "status",
  "score",
  "enrichment_source",
  "enrichment_confidence",
  "raw_data",
  "raw_cnpj_data",
] as const;

const selectLeadSql = `select ${leadColumns.join(", ")} from leads`;

function cleanString(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function normalizeJson(value: LeadWriteInput["raw_data"]) {
  return stringifyJson(value ?? {});
}

function normalizeNullableJson(value: LeadWriteInput["raw_cnpj_data"]) {
  if (value === null || value === undefined) {
    return null;
  }

  return stringifyJson(value);
}

function normalizeLeadInput(userId: string, data: LeadWriteInput) {
  const now = new Date().toISOString();

  return {
    address: cleanString(data.address),
    business_name: cleanString(data.business_name),
    category: cleanString(data.category),
    city: cleanString(data.city),
    cnae: cleanString(data.cnae),
    cnae_description: cleanString(data.cnae_description),
    cnpj: cleanString(data.cnpj),
    country: cleanString(data.country),
    created_at: data.created_at ?? now,
    email: cleanString(data.email),
    enrichment_confidence: data.enrichment_confidence ?? null,
    enrichment_source: cleanString(data.enrichment_source),
    fantasy_name: cleanString(data.fantasy_name),
    id: data.id ?? crypto.randomUUID(),
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    name: data.name.trim(),
    phone: cleanString(data.phone),
    phone_2: cleanString(data.phone_2),
    rating: data.rating ?? null,
    raw_cnpj_data: normalizeNullableJson(data.raw_cnpj_data),
    raw_data: normalizeJson(data.raw_data),
    reviews_count: data.reviews_count ?? null,
    score: data.score ?? 0,
    source: data.source ?? "manual",
    source_place_id: cleanString(data.source_place_id),
    source_url: cleanString(data.source_url),
    state: cleanString(data.state),
    status: data.status ?? "new",
    updated_at: data.updated_at ?? now,
    user_id: userId,
    website: cleanString(data.website),
  };
}

function getLimit(value: number | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 500;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 5000);
}

async function queryLead(sql: string, args: InValue[]) {
  const result = await getTursoClient().execute({ args, sql });

  return result.rows[0] ? rowToTursoLead(result.rows[0]) : null;
}

export async function findDuplicateLead(userId: string, data: Partial<LeadWriteInput>) {
  const source = cleanString(data.source as LeadSource | null | undefined);
  const sourcePlaceId = cleanString(data.source_place_id);
  const cnpj = cleanString(data.cnpj);
  const phone = cleanString(data.phone);
  const phone2 = cleanString(data.phone_2);

  if (source && sourcePlaceId) {
    const bySource = await queryLead(
      `${selectLeadSql} where user_id = ? and source = ? and source_place_id = ? limit 1`,
      [userId, source, sourcePlaceId],
    );

    if (bySource) {
      return bySource;
    }
  }

  if (cnpj) {
    const byCnpj = await queryLead(
      `${selectLeadSql} where user_id = ? and cnpj = ? limit 1`,
      [userId, cnpj],
    );

    if (byCnpj) {
      return byCnpj;
    }
  }

  const phoneValue = phone ?? phone2;

  if (phoneValue) {
    return queryLead(
      `${selectLeadSql} where user_id = ? and (phone = ? or phone_2 = ?) limit 1`,
      [userId, phoneValue, phoneValue],
    );
  }

  return null;
}

export async function createLead(userId: string, data: LeadWriteInput) {
  const duplicate = await findDuplicateLead(userId, data);

  if (duplicate) {
    return rowToLead(duplicate);
  }

  const payload = normalizeLeadInput(userId, data);
  const columns = leadColumns;
  const placeholders = columns.map(() => "?").join(", ");
  const args = columns.map((column) => payload[column]);

  await getTursoClient().execute({
    args,
    sql: `insert into leads (${columns.join(", ")}) values (${placeholders})`,
  });

  const created = await getLeadById(userId, payload.id);

  if (!created) {
    throw new Error("Lead criado, mas nao encontrado no Turso.");
  }

  return created;
}

export async function createManyLeads(userId: string, leads: LeadWriteInput[]): Promise<CreateManyLeadsResult> {
  const created: Lead[] = [];
  const skipped: Lead[] = [];

  for (const lead of leads) {
    const duplicate = await findDuplicateLead(userId, lead);

    if (duplicate) {
      skipped.push(rowToLead(duplicate));
      continue;
    }

    const createdLead = await createLead(userId, lead);
    created.push(createdLead);
  }

  return { created, skipped };
}

export async function listLeads(userId: string, filters: LeadListFilters = {}) {
  const clauses = ["user_id = ?"];
  const args: InValue[] = [userId];

  if (filters.name) {
    const term = `%${filters.name.trim().toLowerCase()}%`;
    clauses.push(
      "(lower(name) like ? or lower(coalesce(business_name, '')) like ? or lower(coalesce(fantasy_name, '')) like ?)",
    );
    args.push(term, term, term);
  }

  if (filters.city) {
    clauses.push("lower(coalesce(city, '')) like ?");
    args.push(`%${filters.city.trim().toLowerCase()}%`);
  }

  if (filters.category) {
    clauses.push("lower(coalesce(category, '')) like ?");
    args.push(`%${filters.category.trim().toLowerCase()}%`);
  }

  if (filters.status && filters.status !== "all") {
    clauses.push("status = ?");
    args.push(filters.status);
  }

  if (filters.source && filters.source !== "all") {
    clauses.push("source = ?");
    args.push(filters.source);
  }

  if (filters.onlyWithPhone) {
    clauses.push("(phone is not null or phone_2 is not null)");
  }

  args.push(getLimit(filters.limit));

  const result = await getTursoClient().execute({
    args,
    sql: `${selectLeadSql} where ${clauses.join(" and ")} order by datetime(created_at) desc limit ?`,
  });

  return result.rows.map(rowToLead);
}

export async function getLeadById(userId: string, leadId: string) {
  const lead = await queryLead(`${selectLeadSql} where user_id = ? and id = ? limit 1`, [userId, leadId]);

  return lead ? rowToLead(lead) : null;
}

export async function updateLead(userId: string, leadId: string, data: LeadUpdateInput) {
  const sets: string[] = [];
  const args: InValue[] = [];

  for (const column of mutableColumns) {
    if (!(column in data)) {
      continue;
    }

    const value = data[column];
    sets.push(`${column} = ?`);

    if (column === "raw_data") {
      args.push(normalizeJson(value as LeadWriteInput["raw_data"]));
    } else if (column === "raw_cnpj_data") {
      args.push(normalizeNullableJson(value as LeadWriteInput["raw_cnpj_data"]));
    } else if (typeof value === "string") {
      args.push(cleanString(value));
    } else {
      args.push((value ?? null) as InValue);
    }
  }

  if (sets.length === 0) {
    return getLeadById(userId, leadId);
  }

  sets.push("updated_at = ?");
  args.push(new Date().toISOString(), userId, leadId);

  const result = await getTursoClient().execute({
    args,
    sql: `update leads set ${sets.join(", ")} where user_id = ? and id = ?`,
  });

  if (result.rowsAffected === 0) {
    return null;
  }

  return getLeadById(userId, leadId);
}

export async function deleteLead(userId: string, leadId: string) {
  return (await deleteLeads(userId, [leadId])) > 0;
}

export async function deleteLeads(userId: string, leadIds: string[]) {
  const ids = Array.from(new Set(leadIds.map(cleanString).filter(Boolean)));

  if (ids.length === 0) {
    return 0;
  }

  const placeholders = ids.map(() => "?").join(", ");
  const args: InValue[] = [userId, ...ids];
  const client = getTursoClient();

  await client.execute({
    args,
    sql: `delete from lead_messages where user_id = ? and lead_id in (${placeholders})`,
  });

  await client.execute({
    args,
    sql: `delete from lead_notes where user_id = ? and lead_id in (${placeholders})`,
  });

  const result = await getTursoClient().execute({
    args,
    sql: `delete from leads where user_id = ? and id in (${placeholders})`,
  });

  return Number(result.rowsAffected ?? 0);
}

export async function updateLeadStatus(userId: string, leadId: string, status: LeadStatus) {
  return updateLead(userId, leadId, { status });
}

export async function countLeads(userId: string) {
  const result = await getTursoClient().execute({
    args: [userId],
    sql: "select count(*) as total from leads where user_id = ?",
  });

  return Number(result.rows[0]?.total ?? 0);
}

async function countByColumn(userId: string, column: "status" | "source" | "city" | "category") {
  const result = await getTursoClient().execute({
    args: [userId],
    sql: `select coalesce(${column}, '') as label, count(*) as value from leads where user_id = ? group by ${column}`,
  });

  return result.rows.map((row): CountPoint => ({
    label: String(row.label || "Sem valor"),
    value: Number(row.value ?? 0),
  }));
}

export async function countLeadsByStatus(userId: string) {
  return countByColumn(userId, "status");
}

export async function countLeadsBySource(userId: string) {
  return countByColumn(userId, "source");
}

export async function countLeadsByCity(userId: string) {
  return countByColumn(userId, "city");
}

export async function countLeadsByCategory(userId: string) {
  return countByColumn(userId, "category");
}

export async function countLeadsWithPhone(userId: string) {
  const result = await getTursoClient().execute({
    args: [userId],
    sql: "select count(*) as total from leads where user_id = ? and (phone is not null or phone_2 is not null)",
  });

  return Number(result.rows[0]?.total ?? 0);
}
