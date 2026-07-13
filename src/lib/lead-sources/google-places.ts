import { getLeadCategoryLabel, resolveLeadCategoryId, type LeadCategoryId } from "@/config/lead-categories";
import type {
  GooglePlacesSearchParams,
  LeadSourceProvider,
  NormalizedLead,
} from "@/src/lib/lead-sources/types";

type GooglePlacesText = {
  languageCode?: string;
  text?: string;
};

type GooglePlacesLocation = {
  latitude?: number;
  longitude?: number;
};

type GooglePlace = {
  displayName?: GooglePlacesText;
  formattedAddress?: string;
  googleMapsUri?: string;
  id?: string;
  internationalPhoneNumber?: string;
  location?: GooglePlacesLocation;
  nationalPhoneNumber?: string;
  primaryType?: string;
  primaryTypeDisplayName?: GooglePlacesText;
  rating?: number;
  types?: string[];
  userRatingCount?: number;
  websiteUri?: string;
};

type GooglePlacesResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  nextPageToken?: string;
  places?: GooglePlace[];
};

type GoogleGeocodeResponse = {
  error_message?: string;
  results?: {
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }[];
  status?: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

const fieldMask = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.googleMapsUri",
  "places.internationalPhoneNumber",
  "places.location",
  "places.nationalPhoneNumber",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.types",
  "places.userRatingCount",
  "places.websiteUri",
  "nextPageToken",
].join(",");

const googleIncludedTypes: Partial<Record<LeadCategoryId, string>> = {
  academia: "gym",
  bar: "bar",
  cafeteria: "cafe",
  clinica: "doctor",
  dentista: "dentist",
  escola: "school",
  hotel: "hotel",
  imobiliaria: "real_estate_agency",
  loja: "store",
  mercado: "supermarket",
  oficina: "car_repair",
  pet_shop: "pet_store",
  pousada: "lodging",
  restaurante: "restaurant",
  salao_de_beleza: "beauty_salon",
};

function getGooglePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
}

export function hasGooglePlacesConfig() {
  return Boolean(getGooglePlacesApiKey());
}

function buildTextQuery(params: GooglePlacesSearchParams) {
  const category = getLeadCategoryLabel(params.category);

  return `${category} em ${params.city}, ${params.state}, ${params.country}`;
}

function getRegionCode(country: string) {
  return country.trim().toLowerCase() === "brasil" ? "BR" : undefined;
}

function getRadiusMeters(radiusKm: number) {
  return Math.min(Math.max(radiusKm, 1), 50) * 1000;
}

function buildLocationBias(center: Coordinates | null, params: GooglePlacesSearchParams) {
  if (!center) {
    return undefined;
  }

  return {
    circle: {
      center,
      radius: getRadiusMeters(params.radiusKm),
    },
  };
}

async function geocodeSearchCenter(params: GooglePlacesSearchParams): Promise<Coordinates | null> {
  const apiKey = getGooglePlacesApiKey();
  const address = `${params.city}, ${params.state}, ${params.country}`;
  const searchParams = new URLSearchParams({
    address,
    key: apiKey,
    language: "pt-BR",
  });
  const regionCode = getRegionCode(params.country);

  if (regionCode) {
    searchParams.set("region", regionCode.toLowerCase());
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${searchParams.toString()}`,
    );
    const payload = (await response.json()) as GoogleGeocodeResponse;
    const location = payload.results?.[0]?.geometry?.location;
    const latitude = location?.lat;
    const longitude = location?.lng;

    if (
      !response.ok ||
      payload.status !== "OK" ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return null;
    }

    return {
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
}

function toNormalizedLead(place: GooglePlace, params: GooglePlacesSearchParams): NormalizedLead | null {
  if (!place.id) {
    return null;
  }

  const category =
    place.primaryTypeDisplayName?.text ??
    place.primaryType ??
    getLeadCategoryLabel(params.category);

  return {
    address: place.formattedAddress ?? null,
    businessName: null,
    category,
    city: params.city,
    cnae: null,
    cnaeDescription: null,
    cnpj: null,
    country: params.country,
    email: null,
    fantasyName: place.displayName?.text ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    name: place.displayName?.text ?? "Empresa sem nome",
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    phone2: null,
    rating: place.rating ?? null,
    rawData: {
      fetchedAt: new Date().toISOString(),
      provider: "google_places",
      query: buildTextQuery(params),
      sourcePlaceId: place.id,
    },
    reviewsCount: place.userRatingCount ?? null,
    source: "google_places",
    sourcePlaceId: place.id,
    sourceUrl: place.googleMapsUri ?? null,
    state: params.state,
    website: place.websiteUri ?? null,
  };
}

function matchesLeadFilters(lead: NormalizedLead, params: GooglePlacesSearchParams) {
  if (params.onlyWithPhone && !lead.phone) {
    return false;
  }

  if (params.onlyWithWebsite && !lead.website) {
    return false;
  }

  return true;
}

function formatGooglePlacesError(payload: GooglePlacesResponse) {
  const message = payload.error?.message ?? "";
  const normalized = message.toLowerCase();

  if (normalized.includes("api key") || normalized.includes("permission") || normalized.includes("referer")) {
    return "Google Places recusou a chave. Verifique GOOGLE_PLACES_API_KEY, restricoes da chave e se a Places API esta habilitada.";
  }

  if (normalized.includes("billing")) {
    return "Google Places exige billing ativo no Google Cloud para retornar leads.";
  }

  if (normalized.includes("quota") || normalized.includes("rate")) {
    return "Quota do Google Places atingida. Revise limites e billing no Google Cloud.";
  }

  return message || "Google Places API nao respondeu com sucesso. Verifique chave, billing e permissao da Places API.";
}

async function requestGooglePlaces(
  params: GooglePlacesSearchParams,
  searchCenter: Coordinates | null,
  pageToken?: string,
) {
  const apiKey = getGooglePlacesApiKey();

  if (!apiKey) {
    throw new Error("Google Places nao configurado. Defina GOOGLE_PLACES_API_KEY no .env.local e na Vercel.");
  }

  const categoryId = resolveLeadCategoryId(params.category);
  const includedType = categoryId ? googleIncludedTypes[categoryId] : undefined;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    body: JSON.stringify({
      includedType,
      includePureServiceAreaBusinesses: true,
      languageCode: "pt-BR",
      locationBias: buildLocationBias(searchCenter, params),
      pageSize: Math.min(Math.max(params.limit, 1), 20),
      pageToken,
      regionCode: getRegionCode(params.country),
      textQuery: buildTextQuery(params),
    }),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    method: "POST",
  });

  const payload = (await response.json()) as GooglePlacesResponse;

  if (!response.ok) {
    throw new Error(formatGooglePlacesError(payload));
  }

  return payload;
}

export const googlePlacesProvider: LeadSourceProvider<GooglePlacesSearchParams> = {
  id: "google_places",
  name: "Google Places API oficial",
  async search(params) {
    const requestedLimit = Math.min(Math.max(params.limit, 1), 60);
    const results: NormalizedLead[] = [];
    const seen = new Set<string>();
    let pageToken: string | undefined;
    const searchCenter = await geocodeSearchCenter(params);

    do {
      const payload = await requestGooglePlaces(
        {
          ...params,
          limit: Math.min(20, requestedLimit - results.length),
        },
        searchCenter,
        pageToken,
      );

      for (const place of payload.places ?? []) {
        const lead = toNormalizedLead(place, params);

        if (!lead || seen.has(lead.sourcePlaceId)) {
          continue;
        }

        seen.add(lead.sourcePlaceId);

        if (!matchesLeadFilters(lead, params)) {
          continue;
        }

        results.push(lead);

        if (results.length >= requestedLimit) {
          break;
        }
      }

      pageToken = payload.nextPageToken;
    } while (pageToken && results.length < requestedLimit);

    return results;
  },
};
