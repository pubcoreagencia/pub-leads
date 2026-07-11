import type { ApifyActorRun } from "@/src/lib/apify/types";

const baseUrl = "https://api.apify.com/v2";

function getToken() {
  return process.env.APIFY_TOKEN?.trim() ?? "";
}

export function hasApifyConfig() {
  return Boolean(getToken());
}

export async function requestApify<T>(path: string, init?: RequestInit) {
  const token = getToken();
  if (!token) throw new Error("Apify indisponível. Configure APIFY_TOKEN no ambiente do servidor.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | T | null;
  if (!response.ok) throw new Error((body as { error?: { message?: string } } | null)?.error?.message ?? "Erro ao consultar Apify.");
  return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
}

export function startApifyActor(actorId: string, input: Record<string, unknown>) {
  return requestApify<ApifyActorRun>(`/actors/${encodeURIComponent(actorId)}/runs`, { body: JSON.stringify(input), method: "POST" });
}

export function startApifyTask(taskId: string, input?: Record<string, unknown>) {
  return requestApify<ApifyActorRun>(`/actor-tasks/${encodeURIComponent(taskId)}/runs`, {
    body: input ? JSON.stringify(input) : undefined,
    method: "POST",
  });
}

export function getApifyRun(runId: string) {
  return requestApify<ApifyActorRun>(`/actor-runs/${encodeURIComponent(runId)}`);
}

export function getApifyDatasetItems<T>(datasetId: string, limit: number) {
  return requestApify<T[]>(`/datasets/${encodeURIComponent(datasetId)}/items?clean=1&limit=${limit}`);
}
