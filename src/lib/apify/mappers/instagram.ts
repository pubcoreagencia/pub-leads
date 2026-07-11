import type { NormalizedLead } from "@/src/lib/lead-sources/types";
import { qualifyLeadAfterScraping } from "@/src/lib/lead-qualification/qualifier";

function stringValue(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof item[key] === "string" && item[key]) return String(item[key]);
  }
  return null;
}

export function mapApifyInstagramItem(item: Record<string, unknown>, city: string, state: string, niche?: string | null): NormalizedLead {
  const username = stringValue(item, ["username", "handle", "userName", "profileName"]);
  const fullName = stringValue(item, ["fullName", "name", "title"]);
  const instagramUrl = stringValue(item, ["url", "profileUrl", "instagramUrl"]) ?? (username ? `https://www.instagram.com/${username.replace(/^@/, "")}/` : null);
  const sourcePlaceId = instagramUrl ?? username ?? crypto.randomUUID();
  const website = stringValue(item, ["externalUrl", "website", "websiteUrl", "link"]);
  const lead = {
    address: null,
    businessName: fullName ?? username,
    category: niche || "Instagram",
    cnae: null,
    cnaeDescription: null,
    cnpj: null,
    city,
    country: "Brasil",
    email: stringValue(item, ["email", "publicEmail"]),
    fantasyName: username,
    latitude: null,
    longitude: null,
    name: fullName ?? username ?? "Perfil do Instagram",
    phone: stringValue(item, ["phone", "publicPhone"]),
    phone2: null,
    rating: null,
    rawData: {
      ...item,
      instagram_handle: username?.replace(/^@/, "") ?? null,
      instagram_source: "apify",
      instagram_url: instagramUrl,
      qualification: {
        instagram_checked_at: new Date().toISOString(),
        instagram_handle: username?.replace(/^@/, "") ?? null,
        instagram_status: "found",
        instagram_url: instagramUrl,
        qualification_tags: ["instagram"],
      },
    },
    reviewsCount: null,
    source: "apify_instagram" as const,
    sourcePlaceId,
    sourceUrl: instagramUrl,
    state,
    website,
  };
  const qualified = qualifyLeadAfterScraping(lead);
  return { ...lead, qualification: qualified.qualification, rawData: qualified.rawData };
}
