export type WhatsappStatus = "confirmed" | "possible" | "missing" | "invalid" | "unknown";
export type InstagramStatus = "found" | "missing" | "unknown";

export type LeadQualificationTag =
  | "whatsapp_confirmado"
  | "possivel_whatsapp"
  | "sem_whatsapp"
  | "instagram"
  | "sem_instagram";

export type LeadQualification = {
  whatsapp_status: WhatsappStatus;
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
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getMetadata(lead: QualifiableLead) {
  if (isRecord(lead.metadata)) {
    return lead.metadata;
  }

  if (isRecord(lead.rawData)) {
    return lead.rawData;
  }

  if (isRecord(lead.raw)) {
    return lead.raw;
  }

  return {};
}

function toString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getExistingQualification(metadata: JsonRecord, lead?: QualifiableLead) {
  const existing = lead?.qualification ?? metadata.qualification;

  return isRecord(existing) ? (existing as Partial<LeadQualification>) : null;
}

export function normalizeBrazilianPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (!digits) {
    return null;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length === 12 || digits.length === 13) {
    return digits.startsWith("55") ? digits : null;
  }

  return null;
}

function hasAnyPhone(values: Array<string | null | undefined>) {
  return values.some((value) => Boolean(value?.replace(/\D/g, "")));
}

export function qualifyWhatsapp({
  metadata,
  phone,
  phone2,
  whatsapp,
}: {
  metadata?: JsonRecord | null;
  phone?: string | null;
  phone2?: string | null;
  whatsapp?: string | null;
}) {
  const checkedAt = new Date().toISOString();
  const existing = isRecord(metadata) ? getExistingQualification(metadata) : null;

  if (existing?.whatsapp_status === "confirmed") {
    return {
      candidate: normalizeBrazilianPhone(whatsapp ?? phone ?? phone2) ?? null,
      status: "confirmed" as const,
      tags: ["whatsapp_confirmado"] as LeadQualificationTag[],
      whatsapp_checked_at: checkedAt,
    };
  }

  const whatsappCandidate = normalizeBrazilianPhone(whatsapp);

  if (whatsappCandidate) {
    return {
      candidate: whatsappCandidate,
      status: "possible" as const,
      tags: ["possivel_whatsapp"] as LeadQualificationTag[],
      whatsapp_checked_at: checkedAt,
    };
  }

  const phoneCandidate = normalizeBrazilianPhone(phone) ?? normalizeBrazilianPhone(phone2);

  if (phoneCandidate) {
    return {
      candidate: phoneCandidate,
      status: "possible" as const,
      tags: ["possivel_whatsapp"] as LeadQualificationTag[],
      whatsapp_checked_at: checkedAt,
    };
  }

  if (hasAnyPhone([phone, phone2, whatsapp])) {
    return {
      candidate: null,
      status: "invalid" as const,
      tags: [] as LeadQualificationTag[],
      whatsapp_checked_at: checkedAt,
    };
  }

  return {
    candidate: null,
    status: "missing" as const,
    tags: ["sem_whatsapp"] as LeadQualificationTag[],
    whatsapp_checked_at: checkedAt,
  };
}

export function extractInstagramFromTextOrUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const instagramUrlMatch = value.match(
    /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?/i,
  );
  const handleMatch = value.match(/(?:^|\s)@([A-Za-z0-9._]{2,30})(?:\s|$)/);
  const handle = instagramUrlMatch?.[1] ?? handleMatch?.[1];

  if (!handle || ["p", "reel", "reels", "stories", "explore"].includes(handle.toLowerCase())) {
    return null;
  }

  return {
    handle,
    url: `https://www.instagram.com/${handle.replace(/^@/, "")}/`,
  };
}

function findInstagramInMetadata(metadata: JsonRecord) {
  const directValues = [
    metadata.instagram,
    metadata.instagram_url,
    metadata.instagramUrl,
    metadata.instagram_handle,
    metadata.instagramHandle,
    metadata.social_url,
    metadata.socialUrl,
  ];

  for (const value of directValues) {
    const found = extractInstagramFromTextOrUrl(toString(value));

    if (found) {
      return found;
    }
  }

  return extractInstagramFromTextOrUrl(JSON.stringify(metadata));
}

export function qualifyInstagram({
  metadata,
  website,
}: {
  metadata?: JsonRecord | null;
  website?: string | null;
}) {
  const checkedAt = new Date().toISOString();
  const record = isRecord(metadata) ? metadata : {};
  const existing = getExistingQualification(record);
  const existingFound =
    existing?.instagram_status === "found" && (existing.instagram_url || existing.instagram_handle);

  if (existingFound) {
    return {
      instagram_checked_at: existing.instagram_checked_at ?? checkedAt,
      instagram_handle: existing.instagram_handle ?? null,
      instagram_status: "found" as const,
      instagram_url: existing.instagram_url ?? null,
      tags: ["instagram"] as LeadQualificationTag[],
    };
  }

  const found = findInstagramInMetadata(record);

  if (found) {
    return {
      instagram_checked_at: checkedAt,
      instagram_handle: found.handle,
      instagram_status: "found" as const,
      instagram_url: found.url,
      tags: ["instagram"] as LeadQualificationTag[],
    };
  }

  if (website?.trim()) {
    return {
      instagram_checked_at: null,
      instagram_handle: null,
      instagram_status: "unknown" as const,
      instagram_url: null,
      tags: [] as LeadQualificationTag[],
    };
  }

  return {
    instagram_checked_at: checkedAt,
    instagram_handle: null,
    instagram_status: "missing" as const,
    instagram_url: null,
    tags: ["sem_instagram"] as LeadQualificationTag[],
  };
}

export function calculateQualificationScore(qualification: Omit<LeadQualification, "qualification_score">) {
  let score = 0;

  if (qualification.whatsapp_status === "confirmed") {
    score += 50;
  } else if (qualification.whatsapp_status === "possible") {
    score += 35;
  } else if (qualification.whatsapp_status === "missing") {
    score -= 5;
  } else if (qualification.whatsapp_status === "invalid") {
    score -= 10;
  }

  if (qualification.instagram_status === "found") {
    score += 25;
  } else if (qualification.instagram_status === "missing") {
    score -= 2;
  }

  return Math.max(0, Math.min(100, score));
}

export function buildQualificationTags({
  instagram_status,
  whatsapp_status,
}: {
  instagram_status: InstagramStatus;
  whatsapp_status: WhatsappStatus;
}) {
  const tags: LeadQualificationTag[] = [];

  if (whatsapp_status === "confirmed") {
    tags.push("whatsapp_confirmado");
  } else if (whatsapp_status === "possible") {
    tags.push("possivel_whatsapp");
  } else if (whatsapp_status === "missing") {
    tags.push("sem_whatsapp");
  }

  if (instagram_status === "found") {
    tags.push("instagram");
  } else if (instagram_status === "missing") {
    tags.push("sem_instagram");
  }

  return tags;
}

export function mergeQualificationIntoRawData(rawData: JsonRecord, qualification: LeadQualification) {
  return {
    ...rawData,
    instagram_handle: qualification.instagram_handle,
    instagram_url: qualification.instagram_url,
    qualification,
    qualification_score: qualification.qualification_score,
    qualification_tags: qualification.qualification_tags,
    whatsapp_status: qualification.whatsapp_status,
    instagram_status: qualification.instagram_status,
  };
}

export function qualifyLeadAfterScraping<T extends QualifiableLead>(lead: T) {
  const metadata = getMetadata(lead);
  const existing = getExistingQualification(metadata, lead);
  const whatsapp = qualifyWhatsapp({
    metadata,
    phone: lead.phone,
    phone2: lead.phone2 ?? lead.phone_2,
    whatsapp: lead.whatsapp,
  });
  const instagram = qualifyInstagram({
    metadata,
    website: lead.website,
  });

  const qualificationWithoutScore = {
    instagram_checked_at:
      instagram.instagram_checked_at ?? existing?.instagram_checked_at ?? null,
    instagram_handle: instagram.instagram_handle ?? existing?.instagram_handle ?? null,
    instagram_status: instagram.instagram_status,
    instagram_url: instagram.instagram_url ?? existing?.instagram_url ?? null,
    qualification_tags: buildQualificationTags({
      instagram_status: instagram.instagram_status,
      whatsapp_status: whatsapp.status,
    }),
    whatsapp_checked_at: whatsapp.whatsapp_checked_at,
    whatsapp_status: whatsapp.status,
  } satisfies Omit<LeadQualification, "qualification_score">;
  const qualification: LeadQualification = {
    ...qualificationWithoutScore,
    qualification_score: calculateQualificationScore(qualificationWithoutScore),
  };
  const rawData = mergeQualificationIntoRawData(metadata, qualification);

  return {
    ...lead,
    qualification,
    rawData,
  };
}

export function getLeadQualification(lead: QualifiableLead) {
  const metadata = getMetadata(lead);
  const existing = getExistingQualification(metadata, lead);

  if (
    existing?.whatsapp_status &&
    existing.instagram_status &&
    Array.isArray(existing.qualification_tags)
  ) {
    return existing as LeadQualification;
  }

  return qualifyLeadAfterScraping(lead).qualification;
}
