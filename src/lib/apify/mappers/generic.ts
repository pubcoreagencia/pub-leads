import type { NormalizedLead } from "@/src/lib/lead-sources/types";
import { extractInstagramFromTextOrUrl, qualifyLeadAfterScraping } from "@/src/lib/lead-qualification/qualifier";

function stringValue(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof item[key] === "string" && item[key]) return String(item[key]);
  }
  return null;
}

export function mapApifyGenericItem(item: Record<string, unknown>, city: string, state: string, niche?: string | null): NormalizedLead {
  const url = stringValue(item, ["url", "link", "website", "profileUrl"]);
  const title = stringValue(item, ["name", "title", "companyName", "username"]) ?? url ?? "Resultado Apify";
  const instagram = extractInstagramFromTextOrUrl(url);
  const lead = {
    address: stringValue(item, ["address", "fullAddress"]),
    businessName: title,
    category: niche || "Apify",
    cnae: null,
    cnaeDescription: null,
    cnpj: stringValue(item, ["cnpj"]),
    city: stringValue(item, ["city"]) ?? city,
    country: "Brasil",
    email: stringValue(item, ["email"]),
    fantasyName: stringValue(item, ["username"]),
    latitude: typeof item.latitude === "number" ? item.latitude : null,
    longitude: typeof item.longitude === "number" ? item.longitude : null,
    name: title,
    phone: stringValue(item, ["phone", "telephone"]),
    phone2: null,
    rating: null,
    rawData: { ...item, instagram_handle: instagram?.handle ?? null, instagram_url: instagram?.url ?? null },
    reviewsCount: null,
    source: "apify_generic" as const,
    sourcePlaceId: url ?? title,
    sourceUrl: url,
    state: stringValue(item, ["state"]) ?? state,
    website: instagram ? null : url,
  };
  const qualified = qualifyLeadAfterScraping(lead);
  return { ...lead, qualification: qualified.qualification, rawData: qualified.rawData };
}
