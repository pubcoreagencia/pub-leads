import {
  classifyBrazilPhone,
  getWhatsappCandidate,
  normalizeBrazilPhone,
  type BrazilPhoneType,
} from "@/src/lib/lead-qualification/phone-normalization";

export type WhatsappStatus = "confirmed" | "possible" | "landline" | "missing" | "invalid" | "unknown";
export type WhatsappValidationSource = "direct_whatsapp_link" | "official_provider" | "mobile_pattern" | "phone_field" | "website_link" | "manual" | "none";
export type InstagramStatus = "found" | "missing" | "unknown";

export type LeadQualificationTag =
  | "whatsapp_confirmado"
  | "possivel_whatsapp"
  | "telefone_fixo"
  | "sem_whatsapp"
  | "telefone_invalido"
  | "celular_detectado"
  | "instagram"
  | "sem_instagram";

export type LeadQualification = {
  phone_type: BrazilPhoneType;
  normalized_phone: string | null;
  normalized_whatsapp: string | null;
  whatsapp_status: WhatsappStatus;
  whatsapp_confidence: number;
  whatsapp_validation_source: WhatsappValidationSource;
  whatsapp_checked_at: string;
  instagram_status: InstagramStatus;
  instagram_url: string | null;
  instagram_handle: string | null;
  instagram_checked_at: string | null;
  qualification_tags: LeadQualificationTag[];
  qualification_score: number;
};

type JsonRecord = Record<string, unknown>;

export type QualifiableLead = {
  phone?: string | null;
  phone2?: string | null;
  phone_2?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  raw?: JsonRecord | null;
  rawData?: JsonRecord | null;
  metadata?: JsonRecord | null;
  qualification?: Partial<LeadQualification> | JsonRecord | null;
  phone_type?: BrazilPhoneType | string | null;
  normalized_phone?: string | null;
  normalized_whatsapp?: string | null;
  whatsapp_status?: WhatsappStatus | string | null;
  whatsapp_confidence?: number | null;
  whatsapp_validation_source?: WhatsappValidationSource | string | null;
  whatsapp_checked_at?: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getMetadata(lead: QualifiableLead) {
  if (isRecord(lead.metadata)) return lead.metadata;
  if (isRecord(lead.rawData)) return lead.rawData;
  if (isRecord(lead.raw)) return lead.raw;
  return {};
}

function getExistingQualification(metadata: JsonRecord, lead?: QualifiableLead) {
  const existing = lead?.qualification ?? metadata.qualification;
  return isRecord(existing) ? (existing as Partial<LeadQualification>) : null;
}

function getDirectWhatsappLinkNumber(metadata: JsonRecord) {
  const enrichment = isRecord(metadata.contact_enrichment) ? metadata.contact_enrichment : {};
  const directCandidate = getWhatsappCandidate(
    toString(metadata.whatsapp_candidate) || toString(enrichment.whatsapp_candidate),
  );

  if (directCandidate) {
    return directCandidate;
  }

  const data = JSON.stringify(metadata);
  const match = data.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?[^"\s]*phone=|whatsapp:\/\/send\?[^"\s]*phone=)([0-9+()\s-]{10,20})/i);

  return match?.[1] ? getWhatsappCandidate(match[1]) : null;
}

export function normalizeBrazilianPhone(value: string | null | undefined) {
  return normalizeBrazilPhone(value);
}

export function qualifyWhatsapp({ metadata, phone, phone2, whatsapp }: {
  metadata?: JsonRecord | null;
  phone?: string | null;
  phone2?: string | null;
  whatsapp?: string | null;
}) {
  const checkedAt = new Date().toISOString();
  const record = metadata ?? {};
  const directLink = getDirectWhatsappLinkNumber(record);
  const primary = classifyBrazilPhone(phone ?? phone2 ?? whatsapp);
  const candidates = [whatsapp, phone, phone2].map((value) => classifyBrazilPhone(value));
  const mobile = candidates.find((candidate) => candidate.phoneType === "mobile")?.normalized ?? null;
  const hasAnyNumber = candidates.some((candidate) => candidate.phoneType !== "missing");

  if (directLink) {
    return {
      normalized_phone: primary.normalized,
      normalized_whatsapp: directLink,
      phone_type: "mobile" as const,
      status: "confirmed" as const,
      whatsapp_checked_at: checkedAt,
      whatsapp_confidence: 100,
      whatsapp_validation_source: "direct_whatsapp_link" as const,
    };
  }

  if (mobile) {
    return {
      normalized_phone: primary.normalized ?? mobile,
      normalized_whatsapp: mobile,
      phone_type: "mobile" as const,
      status: "possible" as const,
      whatsapp_checked_at: checkedAt,
      whatsapp_confidence: 60,
      whatsapp_validation_source: "mobile_pattern" as const,
    };
  }

  if (candidates.some((candidate) => candidate.phoneType === "landline")) {
    return {
      normalized_phone: primary.normalized,
      normalized_whatsapp: null,
      phone_type: "landline" as const,
      status: "landline" as const,
      whatsapp_checked_at: checkedAt,
      whatsapp_confidence: 0,
      whatsapp_validation_source: "phone_field" as const,
    };
  }

  if (!hasAnyNumber) {
    return {
      normalized_phone: null,
      normalized_whatsapp: null,
      phone_type: "missing" as const,
      status: "missing" as const,
      whatsapp_checked_at: checkedAt,
      whatsapp_confidence: 0,
      whatsapp_validation_source: "none" as const,
    };
  }

  const status: WhatsappStatus = candidates.some((candidate) => candidate.phoneType === "invalid")
    ? "invalid"
    : "unknown";
  return {
    normalized_phone: primary.normalized,
    normalized_whatsapp: null,
    phone_type: status === "invalid" ? "invalid" as const : "unknown" as const,
    status,
    whatsapp_checked_at: checkedAt,
    whatsapp_confidence: 0,
    whatsapp_validation_source: "phone_field" as const,
  };
}

export function extractInstagramFromTextOrUrl(value: string | null | undefined) {
  if (!value) return null;
  const instagramUrlMatch = value.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?/i);
  const handleMatch = value.match(/(?:^|\s)@([A-Za-z0-9._]{2,30})(?:\s|$)/);
  const handle = instagramUrlMatch?.[1] ?? handleMatch?.[1];
  if (!handle || ["p", "reel", "reels", "stories", "explore"].includes(handle.toLowerCase())) return null;
  return { handle, url: `https://www.instagram.com/${handle.replace(/^@/, "")}/` };
}

function qualifyInstagram({ metadata, website }: { metadata?: JsonRecord | null; website?: string | null }) {
  const checkedAt = new Date().toISOString();
  const record = metadata ?? {};
  const data = JSON.stringify(record);
  const found = extractInstagramFromTextOrUrl(toString(record.instagram_url)) ?? extractInstagramFromTextOrUrl(data);
  if (found) return { instagram_checked_at: checkedAt, instagram_handle: found.handle, instagram_status: "found" as const, instagram_url: found.url };
  if (website?.trim()) return { instagram_checked_at: null, instagram_handle: null, instagram_status: "unknown" as const, instagram_url: null };
  return { instagram_checked_at: checkedAt, instagram_handle: null, instagram_status: "missing" as const, instagram_url: null };
}

export function buildQualificationTags({ instagram_status, whatsapp_status }: { instagram_status: InstagramStatus; whatsapp_status: WhatsappStatus }) {
  const tags: LeadQualificationTag[] = [];
  if (whatsapp_status === "confirmed") tags.push("whatsapp_confirmado", "celular_detectado");
  if (whatsapp_status === "possible") tags.push("possivel_whatsapp", "celular_detectado");
  if (whatsapp_status === "landline") tags.push("telefone_fixo");
  if (whatsapp_status === "missing") tags.push("sem_whatsapp");
  if (whatsapp_status === "invalid") tags.push("telefone_invalido");
  if (instagram_status === "found") tags.push("instagram");
  if (instagram_status === "missing") tags.push("sem_instagram");
  return tags;
}

export function calculateQualificationScore(qualification: Omit<LeadQualification, "qualification_score">) {
  let score = qualification.whatsapp_status === "confirmed" ? 50 : qualification.whatsapp_status === "possible" ? 35 : 0;
  if (qualification.instagram_status === "found") score += 25;
  if (qualification.whatsapp_status === "invalid") score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function mergeQualificationIntoRawData(rawData: JsonRecord, qualification: LeadQualification) {
  return { ...rawData, instagram_handle: qualification.instagram_handle, instagram_url: qualification.instagram_url, qualification, qualification_score: qualification.qualification_score, qualification_tags: qualification.qualification_tags, whatsapp_status: qualification.whatsapp_status, phone_type: qualification.phone_type };
}

export function qualifyLeadAfterScraping<T extends QualifiableLead>(lead: T) {
  const metadata = getMetadata(lead);
  const whatsapp = qualifyWhatsapp({ metadata, phone: lead.phone, phone2: lead.phone2 ?? lead.phone_2, whatsapp: lead.whatsapp });
  const instagram = qualifyInstagram({ metadata, website: lead.website });
  const withoutScore = {
    ...whatsapp,
    instagram_checked_at: instagram.instagram_checked_at,
    instagram_handle: instagram.instagram_handle,
    instagram_status: instagram.instagram_status,
    instagram_url: instagram.instagram_url,
    qualification_tags: buildQualificationTags({ instagram_status: instagram.instagram_status, whatsapp_status: whatsapp.status }),
    whatsapp_status: whatsapp.status,
  } satisfies Omit<LeadQualification, "qualification_score">;
  const qualification = { ...withoutScore, qualification_score: calculateQualificationScore(withoutScore) };
  return { ...lead, qualification, rawData: mergeQualificationIntoRawData(metadata, qualification) };
}

export function getLeadQualification(lead: QualifiableLead) {
  const metadata = getMetadata(lead);
  const existing = getExistingQualification(metadata, lead);
  if (existing?.phone_type && existing.whatsapp_status && existing.whatsapp_validation_source && Array.isArray(existing.qualification_tags)) return existing as LeadQualification;
  return qualifyLeadAfterScraping(lead).qualification;
}
