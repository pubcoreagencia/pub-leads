import type { InValue } from "@libsql/client";

import type { Lead, LeadSource, LeadStatus } from "@/schemas/lead";
import { qualifyLeadAfterScraping } from "@/src/lib/lead-qualification/qualifier";
import { getTursoClient } from "@/src/lib/turso/client";
import { parseJsonRecord, rowToLead, rowToTursoLead, stringifyJson } from "@/src/lib/turso/mappers";
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
  "whatsapp",
  "phone_type",
  "normalized_phone",
  "normalized_whatsapp",
  "whatsapp_status",
  "whatsapp_confidence",
  "whatsapp_validation_source",
  "whatsapp_checked_at",
  "qualification_tags",
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
  "whatsapp",
  "phone_type",
  "normalized_phone",
  "normalized_whatsapp",
  "whatsapp_status",
  "whatsapp_confidence",
  "whatsapp_validation_source",
  "whatsapp_checked_at",
  "qualification_tags",
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
  const metadata = typeof data.raw_data === "string" ? parseJsonRecord(data.raw_data) : data.raw_data ?? {};
  const classified = qualifyLeadAfterScraping({
    phone: data.phone,
    phone2: data.phone_2,
    rawData: metadata,
    whatsapp: data.whatsapp,
    website: data.website,
  });
  const qualification = classified.qualification;

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
    whatsapp: qualification.whatsapp_status === "confirmed" || qualification.whatsapp_status === "possible" ? qualification.normalized_whatsapp : null,
    phone_type: qualification.phone_type,
    normalized_phone: qualification.normalized_phone,
    normalized_whatsapp: qualification.normalized_whatsapp,
    whatsapp_status: qualification.whatsapp_status,
    whatsapp_confidence: qualification.whatsapp_confidence,
    whatsapp_validation_source: qualification.whatsapp_validation_source,
    whatsapp_checked_at: qualification.whatsapp_checked_at,
    qualification_tags: JSON.stringify(qualification.qualification_tags),
    rating: data.rating ?? null,
    raw_cnpj_data: normalizeNullableJson(data.raw_cnpj_data),
    raw_data: normalizeJson(classified.rawData),
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
  const website = cleanString(data.website);
  const name = cleanString(data.name);
  const city = cleanString(data.city);

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

  if (website) {
    const byWebsite = await queryLead(
      `${selectLeadSql} where user_id = ? and lower(coalesce(website, '')) = lower(?) limit 1`,
      [userId, website],
    );
    if (byWebsite) return byWebsite;
  }

  if (name && city) {
    const byNameAndCity = await queryLead(
      `${selectLeadSql} where user_id = ? and lower(name) = lower(?) and lower(coalesce(city, '')) = lower(?) limit 1`,
      [userId, name, city],
    );
    if (byNameAndCity) return byNameAndCity;
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

  if (filters.savedDate) {
    const start = new Date(`${filters.savedDate}T00:00:00.000Z`);

    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      clauses.push("datetime(created_at) >= datetime(?) and datetime(created_at) < datetime(?)");
      args.push(start.toISOString(), end.toISOString());
    }
  }

  if (filters.qualification === "with_whatsapp") {
    clauses.push(
      "(raw_data like '%whatsapp_status%confirmed%' or raw_data like '%whatsapp_status%possible%')",
    );
  }

  if (filters.qualification === "without_whatsapp") {
    clauses.push(
      "(whatsapp_status in ('landline', 'missing', 'invalid') or raw_data like '%whatsapp_status%landline%' or raw_data like '%whatsapp_status%missing%' or raw_data like '%whatsapp_status%invalid%')",
    );
  }

  if (filters.qualification === "with_instagram") {
    clauses.push("raw_data like '%instagram_status%found%'");
  }

  if (filters.qualification === "without_instagram") {
    clauses.push("raw_data like '%instagram_status%missing%'");
  }

  if (filters.site === "with_site") {
    clauses.push("website is not null and website != ''");
  }

  if (filters.site === "without_site") {
    clauses.push("(website is null or website = '')");
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
  const current = await getLeadById(userId, leadId);

  if (!current) {
    return null;
  }

  const contactFieldsChanged = ["phone", "phone_2", "whatsapp", "website", "raw_data"].some((field) => field in data);
  const nextRawData =
    typeof data.raw_data === "string" ? parseJsonRecord(data.raw_data) : data.raw_data ?? current.metadata;
  const classified = contactFieldsChanged
    ? qualifyLeadAfterScraping({
        phone: data.phone ?? current.phone,
        phone2: data.phone_2 ?? current.phone_2,
        rawData: nextRawData,
        website: data.website ?? current.website,
        whatsapp: data.whatsapp ?? current.whatsapp,
      })
    : null;
  const updateData: LeadUpdateInput = classified
    ? {
        ...data,
        normalized_phone: classified.qualification.normalized_phone,
        normalized_whatsapp: classified.qualification.normalized_whatsapp,
        phone_type: classified.qualification.phone_type,
        qualification_tags: JSON.stringify(classified.qualification.qualification_tags),
        raw_data: classified.rawData,
        whatsapp:
          classified.qualification.whatsapp_status === "confirmed" ||
          classified.qualification.whatsapp_status === "possible"
            ? classified.qualification.normalized_whatsapp
            : null,
        whatsapp_checked_at: classified.qualification.whatsapp_checked_at,
        whatsapp_confidence: classified.qualification.whatsapp_confidence,
        whatsapp_status: classified.qualification.whatsapp_status,
        whatsapp_validation_source: classified.qualification.whatsapp_validation_source,
      }
    : data;
  const sets: string[] = [];
  const args: InValue[] = [];

  for (const column of mutableColumns) {
    if (!(column in updateData)) {
      continue;
    }

    const value = updateData[column];
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

export async function updateLeadsStatus(userId: string, leadIds: string[], status: LeadStatus) {
  const ids = Array.from(new Set(leadIds.map(cleanString).filter(Boolean)));

  if (ids.length === 0) {
    return 0;
  }

  const placeholders = ids.map(() => "?").join(", ");
  const result = await getTursoClient().execute({
    args: [status, new Date().toISOString(), userId, ...ids],
    sql: `update leads set status = ?, updated_at = ? where user_id = ? and id in (${placeholders})`,
  });

  return Number(result.rowsAffected ?? 0);
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
