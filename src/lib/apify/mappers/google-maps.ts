import type { NormalizedLead } from "@/src/lib/lead-sources/types";
import { qualifyLeadAfterScraping } from "@/src/lib/lead-qualification/qualifier";

export function mapApifyGoogleMapsItem(item: Record<string, unknown>, city: string, state: string, niche?: string | null): NormalizedLead {
  const location = item.location as { lat?: number; lng?: number } | undefined;
  const phone = typeof item.phoneUnformatted === "string" ? item.phoneUnformatted : typeof item.phone === "string" ? item.phone : null;
  const sourcePlaceId = String(item.placeId ?? item.cid ?? item.url ?? item.title ?? crypto.randomUUID());
  const lead = {
    address: typeof item.address === "string" ? item.address : null,
    businessName: typeof item.title === "string" ? item.title : null,
    category: typeof item.categoryName === "string" ? item.categoryName : niche || "outros",
    cnae: null,
    cnaeDescription: null,
    cnpj: null,
    city,
    country: "Brasil",
    email: typeof item.email === "string" ? item.email : null,
    fantasyName: null,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    name: String(item.title ?? item.name ?? "Empresa sem nome"),
    phone,
    phone2: null,
    rating: typeof item.rating === "number" ? item.rating : null,
    rawData: { ...item, apify_source: "google_maps" },
    reviewsCount: typeof item.reviewsCount === "number" ? item.reviewsCount : null,
    source: "google_places" as const,
    sourcePlaceId,
    sourceUrl: typeof item.url === "string" ? item.url : null,
    state,
    website: typeof item.website === "string" ? item.website : null,
  };
  const qualified = qualifyLeadAfterScraping(lead);
  return { ...lead, qualification: qualified.qualification, rawData: qualified.rawData };
}
