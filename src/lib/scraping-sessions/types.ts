import type { LeadQualification } from "@/src/lib/lead-qualification/qualifier";
import type { LeadSourceId, NormalizedLead } from "@/src/lib/lead-sources/types";
import type { JsonRecord, ScrapingSessionStatus } from "@/src/lib/turso/types";

export type ScrapingSession = {
  id: string;
  user_id: string;
  source: string;
  status: ScrapingSessionStatus;
  city: string | null;
  niche: string | null;
  query: string | null;
  requested_limit: number | null;
  results_count: number;
  selected_count: number;
  filters: JsonRecord;
  source_run_id: string | null;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  error_message: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};

export type ScrapingSessionLead = NormalizedLead & {
  externalId: string;
  qualification?: LeadQualification;
  saved?: boolean;
  savedLeadId?: string | null;
  selected?: boolean;
  sessionResultId: string;
  source: LeadSourceId;
};

export type ScrapingSessionWithResults = {
  results: ScrapingSessionLead[];
  session: ScrapingSession;
};
