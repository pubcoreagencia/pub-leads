import { getLeadCategoryLabel, resolveLeadCategoryId, type LeadCategoryId } from "@/config/lead-categories";
import type { ExternalLead, LeadSourceProvider, LeadSourceSearchParams } from "@/src/lib/lead-sources/types";

type NominatimResult = {
  lat: string;
  lon: string;
};

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type OsmTagFilter = {
  key: string;
  value: string;
};

const categoryTagFilters: Record<LeadCategoryId, OsmTagFilter[]> = {
  restaurante: [{ key: "amenity", value: "restaurant" }],
  bar: [
    { key: "amenity", value: "bar" },
    { key: "amenity", value: "pub" },
  ],
  cafeteria: [{ key: "amenity", value: "cafe" }],
  hotel: [{ key: "tourism", value: "hotel" }],
  pousada: [{ key: "tourism", value: "guest_house" }],
  academia: [{ key: "leisure", value: "fitness_centre" }],
  clinica: [{ key: "amenity", value: "clinic" }],
  dentista: [{ key: "amenity", value: "dentist" }],
  loja: [{ key: "shop", value: "yes" }],
  oficina: [{ key: "shop", value: "car_repair" }],
  imobiliaria: [{ key: "office", value: "estate_agent" }],
  salao_de_beleza: [{ key: "shop", value: "hairdresser" }],
  pet_shop: [{ key: "shop", value: "pet" }],
  escola: [{ key: "amenity", value: "school" }],
  mercado: [{ key: "shop", value: "supermarket" }],
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function escapeOverpassString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCategoryTagFilters(category: string) {
  const categoryId = resolveLeadCategoryId(category);

  return categoryId ? categoryTagFilters[categoryId] : null;
}

function buildTextSelectors(params: LeadSourceSearchParams, scope: string) {
  const pattern = escapeOverpassString(escapeRegex(params.category));

  return [
    `node["name"~"${pattern}",i]${scope};`,
    `way["name"~"${pattern}",i]${scope};`,
    `relation["name"~"${pattern}",i]${scope};`,
    `node["brand"~"${pattern}",i]${scope};`,
    `way["brand"~"${pattern}",i]${scope};`,
    `relation["brand"~"${pattern}",i]${scope};`,
  ].join("\n");
}

function getTag(tags: Record<string, string> | undefined, keys: string[]) {
  return keys.map((key) => tags?.[key]).find(Boolean) ?? null;
}

function buildAddress(tags: Record<string, string> | undefined) {
  if (!tags) {
    return null;
  }

  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  const suburb = tags["addr:suburb"];
  const postcode = tags["addr:postcode"];
  const parts = [
    street && number ? `${street}, ${number}` : street,
    suburb,
    postcode,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : null;
}

async function geocodeLocation(params: LeadSourceSearchParams) {
  const query = normalizeText(`${params.city}, ${params.state}, ${params.country}`);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "User-Agent": "PubLeads/1.0 contact:admin@publeads.local",
    },
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel localizar a cidade no OpenStreetMap.");
  }

  const results = (await response.json()) as NominatimResult[];
  const firstResult = results[0];

  if (!firstResult) {
    throw new Error("Cidade nao encontrada no OpenStreetMap.");
  }

  return {
    latitude: Number(firstResult.lat),
    longitude: Number(firstResult.lon),
  };
}

function buildOverpassQuery(params: LeadSourceSearchParams, latitude: number, longitude: number) {
  const radiusMeters = Math.max(1, Math.round(params.radiusKm * 1000));
  const filters = getCategoryTagFilters(params.category);
  const scope = `(around:${radiusMeters},${latitude},${longitude})`;
  const selectors = filters
    ? filters
        .flatMap((filter) => [
          `node["${filter.key}"="${filter.value}"]${scope};`,
          `way["${filter.key}"="${filter.value}"]${scope};`,
          `relation["${filter.key}"="${filter.value}"]${scope};`,
        ])
        .join("\n")
    : buildTextSelectors(params, scope);

  return `[out:json][timeout:25];
(
${selectors}
);
out center tags qt ${params.limit};`;
}

function buildOverpassAreaQuery(params: LeadSourceSearchParams) {
  const filters = getCategoryTagFilters(params.category);
  const areaName = escapeOverpassString(params.city);
  const selectors = filters
    ? filters
        .flatMap((filter) => [
          `node["${filter.key}"="${filter.value}"](area.searchArea);`,
          `way["${filter.key}"="${filter.value}"](area.searchArea);`,
          `relation["${filter.key}"="${filter.value}"](area.searchArea);`,
        ])
        .join("\n")
    : buildTextSelectors(params, "(area.searchArea)");

  return `[out:json][timeout:25];
area["boundary"="administrative"]["name"="${areaName}"]->.searchArea;
(
${selectors}
);
out center tags qt ${params.limit};`;
}

function toExternalLead(element: OverpassElement, params: LeadSourceSearchParams): ExternalLead | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (latitude === undefined || longitude === undefined) {
    return null;
  }

  const tags = element.tags ?? {};
  const city = tags["addr:city"] ?? params.city;
  const state = tags["addr:state"] ?? params.state;
  const country = tags["addr:country"] ?? params.country;

  return {
    externalId: `${element.type}/${element.id}`,
    name: getTag(tags, ["name", "brand", "operator"]) ?? `Sem nome (${getLeadCategoryLabel(params.category)})`,
    businessName: null,
    fantasyName: getTag(tags, ["name", "brand", "operator"]),
    cnpj: null,
    category: getLeadCategoryLabel(params.category),
    cnae: null,
    cnaeDescription: null,
    address: buildAddress(tags),
    phone: getTag(tags, ["contact:phone", "phone"]),
    phone2: null,
    email: getTag(tags, ["contact:email", "email"]),
    website: getTag(tags, ["contact:website", "website"]),
    latitude,
    longitude,
    city,
    state,
    country,
    source: "openstreetmap",
    sourcePlaceId: `${element.type}/${element.id}`,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    rating: null,
    reviewsCount: null,
    rawData: {
      osmType: element.type,
      osmId: element.id,
      tags,
    },
    raw: {
      osmType: element.type,
      osmId: element.id,
      tags,
    },
  };
}

export const overpassProvider: LeadSourceProvider<LeadSourceSearchParams, ExternalLead> = {
  id: "openstreetmap",
  name: "OpenStreetMap Overpass",
  async search(params) {
    let query: string;

    try {
      const location = await geocodeLocation(params);
      query = buildOverpassQuery(params, location.latitude, location.longitude);
    } catch {
      query = buildOverpassAreaQuery(params);
    }

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      body: new URLSearchParams({ data: query }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "PubLeads/1.0 contact:admin@publeads.local",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("A Overpass API nao respondeu com sucesso. Tente reduzir raio ou limite.");
    }

    const payload = (await response.json()) as OverpassResponse;
    const seen = new Set<string>();

    return (payload.elements ?? [])
      .map((element) => toExternalLead(element, params))
      .filter((lead): lead is ExternalLead => {
        if (!lead || seen.has(lead.externalId)) {
          return false;
        }

        seen.add(lead.externalId);
        return true;
      })
      .slice(0, params.limit);
  },
};
