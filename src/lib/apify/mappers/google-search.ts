import type { NormalizedLead } from "@/src/lib/lead-sources/types";
import { extractInstagramFromTextOrUrl, qualifyLeadAfterScraping } from "@/src/lib/lead-qualification/qualifier";

function stringValue(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof item[key] === "string" && item[key]) return String(item[key]);
  }
  return null;
}

export function mapApifyGoogleSearchItem(item: Record<string, unknown>, city: string, state: string, niche?: string | null): NormalizedLead {
  const url = stringValue(item, ["url", "link", "displayedUrl"]);
  const title = stringValue(item, ["title", "name"]) ?? url ?? "Resultado Google Search";
  const instagram = extractInstagramFromTextOrUrl(url);
  const sourcePlaceId = url ?? title;
  const lead = {
    address: null,
    businessName: title,
    category: niche || "Google Search",
    cnae: null,
    cnaeDescription: null,
    cnpj: null,
    city,
    country: "Brasil",
    email: stringValue(item, ["email"]),
    fantasyName: null,
    latitude: null,
    longitude: null,
    name: title,
    phone: stringValue(item, ["phone"]),
    phone2: null,
    rating: null,
    rawData: {
      ...item,
      instagram_handle: instagram?.handle ?? null,
      instagram_url: instagram?.url ?? null,
      search_url: url,
    },
    reviewsCount: null,
    source: "apify_google_search" as const,
    sourcePlaceId,
    sourceUrl: url,
    state,
    website: instagram ? null : url,
  };
  const qualified = qualifyLeadAfterScraping(lead);
  return { ...lead, qualification: qualified.qualification, rawData: qualified.rawData };
}
