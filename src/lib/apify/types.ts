export type ApifySourceType = "google_maps" | "instagram" | "google_search" | "generic";
export type ApifyRunStatus = "pending" | "running" | "succeeded" | "failed" | "aborted";
export type ApifySourceKind = "actor" | "task";
export type ApifyLeadMapping = "google_maps" | "instagram_profile" | "google_search" | "generic";

export type ApifySourceDefinition = {
  actorId: string | null;
  category: ApifySourceType;
  defaultInput?: Record<string, unknown> | null;
  description: string | null;
  enabled: boolean;
  estimatedCostLabel: string;
  id: string;
  inputSchema?: Record<string, unknown> | null;
  isRecommended: boolean;
  kind: ApifySourceKind;
  leadMapping: ApifyLeadMapping;
  metadata?: Record<string, unknown>;
  name: string;
  requiresInput: boolean;
  supportedUse: string;
  taskId: string | null;
};

export type ApifyRunRecord = {
  actor_id: string;
  source_category?: ApifySourceType | null;
  source_id?: string | null;
  source_name?: string | null;
  task_id?: string | null;
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
