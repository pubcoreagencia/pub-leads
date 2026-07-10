import type { Lead, LeadFilters, LeadSource, LeadStatus } from "@/schemas/lead";

export type JsonRecord = Record<string, unknown>;

export type TursoLeadRow = {
  id: string;
  user_id: string;
  name: string;
  business_name: string | null;
  fantasy_name: string | null;
  cnpj: string | null;
  category: string | null;
  cnae: string | null;
  cnae_description: string | null;
  phone: string | null;
  phone_2: string | null;
  whatsapp: string | null;
  phone_type: "mobile" | "landline" | "invalid" | "unknown" | "missing";
  normalized_phone: string | null;
  normalized_whatsapp: string | null;
  whatsapp_status: "confirmed" | "possible" | "landline" | "missing" | "invalid" | "unknown";
  whatsapp_confidence: number | null;
  whatsapp_validation_source: string | null;
  whatsapp_checked_at: string | null;
  qualification_tags: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  source: LeadSource | null;
  source_place_id: string | null;
  source_url: string | null;
  rating: number | null;
  reviews_count: number | null;
  status: LeadStatus;
  score: number | null;
  enrichment_source: string | null;
  enrichment_confidence: number | null;
  raw_data: string | null;
  raw_cnpj_data: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadWriteInput = {
  id?: string;
  name: string;
  business_name?: string | null;
  fantasy_name?: string | null;
  cnpj?: string | null;
  category?: string | null;
  cnae?: string | null;
  cnae_description?: string | null;
  phone?: string | null;
  phone_2?: string | null;
  whatsapp?: string | null;
  phone_type?: TursoLeadRow["phone_type"];
  normalized_phone?: string | null;
  normalized_whatsapp?: string | null;
  whatsapp_status?: TursoLeadRow["whatsapp_status"];
  whatsapp_confidence?: number | null;
  whatsapp_validation_source?: string | null;
  whatsapp_checked_at?: string | null;
  qualification_tags?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: LeadSource | null;
  source_place_id?: string | null;
  source_url?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  status?: LeadStatus;
  score?: number | null;
  enrichment_source?: string | null;
  enrichment_confidence?: number | null;
  raw_data?: JsonRecord | string | null;
  raw_cnpj_data?: JsonRecord | string | null;
  created_at?: string;
  updated_at?: string;
};

export type LeadUpdateInput = Partial<Omit<LeadWriteInput, "id" | "created_at">>;

export type LeadListFilters = LeadFilters & {
  limit?: number;
};

export type CreateManyLeadsResult = {
  created: Lead[];
  skipped: Lead[];
};

export type TursoLeadNoteRow = {
  id: string;
  lead_id: string;
  user_id: string;
  note: string;
  created_at: string;
};

export type TursoLeadMessageRow = {
  id: string;
  lead_id: string;
  user_id: string;
  message: string;
  tone: string | null;
  objective: string | null;
  created_at: string;
};

export type SearchLogStatus = "success" | "failed";

export type SearchLogWriteInput = {
  id?: string;
  query?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  category?: string | null;
  result_count?: number;
  source?: string | null;
  status?: SearchLogStatus;
  raw_params?: JsonRecord | string | null;
  created_at?: string;
};

export type TursoSearchLogRow = {
  id: string;
  user_id: string;
  query: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  category: string | null;
  result_count: number;
  source: string | null;
  status: SearchLogStatus;
  raw_params: string | null;
  created_at: string;
};

export type CountPoint = {
  label: string;
  value: number;
};
