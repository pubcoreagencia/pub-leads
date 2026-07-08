import type { Row, Value } from "@libsql/client";

import type { Lead, LeadNote, LeadSource, LeadStatus } from "@/schemas/lead";
import type {
  JsonRecord,
  SearchLogStatus,
  TursoLeadMessageRow,
  TursoLeadNoteRow,
  TursoLeadRow,
  TursoSearchLogRow,
} from "@/src/lib/turso/types";

function valueOf(row: Row | Record<string, unknown>, key: string) {
  return row[key] as Value | unknown;
}

export function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseJsonRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : {};
  } catch {
    return {};
  }
}

export function parseNullableJsonRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsed = parseJsonRecord(value);

  return Object.keys(parsed).length > 0 ? parsed : null;
}

export function stringifyJson(value: JsonRecord | string | null | undefined) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value ?? {});
}

export function rowToTursoLead(row: Row | Record<string, unknown>): TursoLeadRow {
  return {
    address: nullableString(valueOf(row, "address")),
    business_name: nullableString(valueOf(row, "business_name")),
    category: nullableString(valueOf(row, "category")),
    city: nullableString(valueOf(row, "city")),
    cnae: nullableString(valueOf(row, "cnae")),
    cnae_description: nullableString(valueOf(row, "cnae_description")),
    cnpj: nullableString(valueOf(row, "cnpj")),
    country: nullableString(valueOf(row, "country")),
    created_at: String(valueOf(row, "created_at")),
    email: nullableString(valueOf(row, "email")),
    enrichment_confidence: nullableNumber(valueOf(row, "enrichment_confidence")),
    enrichment_source: nullableString(valueOf(row, "enrichment_source")),
    fantasy_name: nullableString(valueOf(row, "fantasy_name")),
    id: String(valueOf(row, "id")),
    latitude: nullableNumber(valueOf(row, "latitude")),
    longitude: nullableNumber(valueOf(row, "longitude")),
    name: String(valueOf(row, "name")),
    phone: nullableString(valueOf(row, "phone")),
    phone_2: nullableString(valueOf(row, "phone_2")),
    rating: nullableNumber(valueOf(row, "rating")),
    raw_cnpj_data: nullableString(valueOf(row, "raw_cnpj_data")),
    raw_data: nullableString(valueOf(row, "raw_data")),
    reviews_count: nullableNumber(valueOf(row, "reviews_count")),
    score: nullableNumber(valueOf(row, "score")),
    source: (nullableString(valueOf(row, "source")) ?? "manual") as LeadSource,
    source_place_id: nullableString(valueOf(row, "source_place_id")),
    source_url: nullableString(valueOf(row, "source_url")),
    state: nullableString(valueOf(row, "state")),
    status: String(valueOf(row, "status")) as LeadStatus,
    updated_at: String(valueOf(row, "updated_at")),
    user_id: String(valueOf(row, "user_id")),
    website: nullableString(valueOf(row, "website")),
  };
}

export function rowToLead(row: Row | Record<string, unknown>): Lead {
  const lead = rowToTursoLead(row);
  const metadata = parseJsonRecord(lead.raw_data);

  return {
    address: lead.address,
    business_name: lead.business_name,
    category: lead.category,
    city: lead.city,
    cnae: lead.cnae,
    cnae_description: lead.cnae_description,
    cnpj: lead.cnpj,
    company: lead.business_name ?? lead.fantasy_name,
    country: lead.country,
    created_at: lead.created_at,
    email: lead.email,
    enrichment_confidence: lead.enrichment_confidence,
    enrichment_source: lead.enrichment_source,
    external_id: lead.source_place_id,
    fantasy_name: lead.fantasy_name,
    id: lead.id,
    latitude: lead.latitude,
    longitude: lead.longitude,
    metadata,
    name: lead.name,
    phone: lead.phone,
    phone_2: lead.phone_2,
    pipeline_stage: lead.status,
    raw_cnpj_data: parseNullableJsonRecord(lead.raw_cnpj_data),
    source: lead.source ?? "manual",
    state: lead.state,
    status: lead.status,
    updated_at: lead.updated_at,
    user_id: lead.user_id,
    website: lead.website,
    whatsapp: lead.phone,
  };
}

export function rowToLeadNote(row: Row | Record<string, unknown>): LeadNote {
  const createdAt = String(valueOf(row, "created_at"));

  return {
    content: String(valueOf(row, "note")),
    created_at: createdAt,
    id: String(valueOf(row, "id")),
    lead_id: String(valueOf(row, "lead_id")),
    updated_at: createdAt,
    user_id: String(valueOf(row, "user_id")),
  };
}

export function rowToTursoLeadNote(row: Row | Record<string, unknown>): TursoLeadNoteRow {
  return {
    created_at: String(valueOf(row, "created_at")),
    id: String(valueOf(row, "id")),
    lead_id: String(valueOf(row, "lead_id")),
    note: String(valueOf(row, "note")),
    user_id: String(valueOf(row, "user_id")),
  };
}

export function rowToTursoLeadMessage(row: Row | Record<string, unknown>): TursoLeadMessageRow {
  return {
    created_at: String(valueOf(row, "created_at")),
    id: String(valueOf(row, "id")),
    lead_id: String(valueOf(row, "lead_id")),
    message: String(valueOf(row, "message")),
    objective: nullableString(valueOf(row, "objective")),
    tone: nullableString(valueOf(row, "tone")),
    user_id: String(valueOf(row, "user_id")),
  };
}

export function rowToSearchLog(row: Row | Record<string, unknown>): TursoSearchLogRow {
  return {
    category: nullableString(valueOf(row, "category")),
    city: nullableString(valueOf(row, "city")),
    country: nullableString(valueOf(row, "country")),
    created_at: String(valueOf(row, "created_at")),
    id: String(valueOf(row, "id")),
    query: nullableString(valueOf(row, "query")),
    raw_params: nullableString(valueOf(row, "raw_params")),
    result_count: Number(valueOf(row, "result_count") ?? 0),
    source: nullableString(valueOf(row, "source")),
    state: nullableString(valueOf(row, "state")),
    status: String(valueOf(row, "status") ?? "success") as SearchLogStatus,
    user_id: String(valueOf(row, "user_id")),
  };
}
