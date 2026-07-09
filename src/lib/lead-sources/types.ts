import type { LeadCategoryId } from "@/config/lead-categories";
import type { Lead } from "@/schemas/lead";
import type { LeadQualification } from "@/src/lib/lead-qualification/qualifier";

export type LeadSourceId = "openstreetmap" | "cnpj_brasil" | "google_places";

export type LeadSourceSearchParams = {
  city: string;
  state: string;
  country: string;
  category: LeadCategoryId;
  radiusKm: number;
  limit: number;
};

export type CnpjLeadSearchParams = {
  query?: string;
  city: string;
  state: string;
  cnae?: string;
  limit: number;
  onlyWithPhone?: boolean;
};

export type GooglePlacesSearchParams = LeadSourceSearchParams & {
  onlyWithPhone?: boolean;
  onlyWithWebsite?: boolean;
};

export type NormalizedLead = {
  name: string;
  businessName: string | null;
  fantasyName: string | null;
  cnpj: string | null;
  category: string;
  cnae: string | null;
  cnaeDescription: string | null;
  address: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string;
  state: string;
  country: string;
  source: LeadSourceId;
  sourcePlaceId: string;
  sourceUrl: string | null;
  rating: number | null;
  reviewsCount: number | null;
  rawData: Record<string, unknown>;
  qualification?: LeadQualification;
  saved?: boolean;
};

export type ExternalLead = NormalizedLead & {
  externalId: string;
  latitude: number;
  longitude: number;
  source: "openstreetmap";
  raw: Record<string, unknown>;
};

export type LeadEnrichmentResult = {
  lead: NormalizedLead;
  confidence: number;
  reasons: string[];
};

export type LeadSourceProvider<TParams = LeadSourceSearchParams, TResult extends NormalizedLead = NormalizedLead> = {
  id: LeadSourceId;
  name: string;
  search(params: TParams): Promise<TResult[]>;
  enrichLead?(lead: Lead): Promise<LeadEnrichmentResult | null>;
};
