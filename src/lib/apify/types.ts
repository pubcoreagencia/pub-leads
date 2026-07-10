export type ApifySourceType = "google_maps" | "instagram" | "google_search";
export type ApifyRunStatus = "pending" | "running" | "succeeded" | "failed" | "aborted";

export type ApifyRunRecord = {
  actor_id: string;
  city: string | null;
  dataset_id: string | null;
  estimated_cost_usd: number;
  finished_at: string | null;
  id: string;
  metadata: Record<string, unknown>;
  niche: string | null;
  requested_limit: number;
  results_count: number;
  run_id: string;
  source_type: ApifySourceType;
  started_at: string;
  status: ApifyRunStatus;
  user_id: string;
};

export type ApifyActorRun = {
  defaultDatasetId?: string;
  finishedAt?: string;
  id: string;
  startedAt?: string;
  status: string;
  usageTotalUsd?: number;
};
