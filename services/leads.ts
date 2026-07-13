import type { Lead, LeadFilters, LeadFormValues, LeadNote, LeadStatus } from "@/schemas/lead";

async function parseJsonResponse<T>(response: Response) {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Nao foi possivel concluir a operacao.");
  }

  return payload;
}

function appendFilter(params: URLSearchParams, key: string, value: string | boolean | undefined) {
  if (value === undefined || value === "" || value === "all") {
    return;
  }

  params.set(key, String(value));
}

export async function fetchLeads(filters: LeadFilters = {}) {
  const params = new URLSearchParams();
  appendFilter(params, "name", filters.name);
  appendFilter(params, "city", filters.city);
  appendFilter(params, "category", filters.category);
  appendFilter(params, "status", filters.status);
  appendFilter(params, "source", filters.source);
  appendFilter(params, "onlyWithPhone", filters.onlyWithPhone ? true : undefined);
  appendFilter(params, "savedDate", filters.savedDate);
  appendFilter(params, "qualification", filters.qualification);
  appendFilter(params, "site", filters.site);

  const query = params.toString();
  const payload = await fetch(`/api/leads${query ? `?${query}` : ""}`, {
    cache: "no-store",
  }).then((response) => parseJsonResponse<{ leads: Lead[] }>(response));

  return payload.leads;
}

export async function createLead(values: LeadFormValues) {
  const payload = await fetch("/api/leads", {
    body: JSON.stringify(values),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }).then((response) => parseJsonResponse<{ lead: Lead }>(response));

  return payload.lead;
}

export async function updateLead(leadId: string, values: LeadFormValues) {
  const payload = await fetch(`/api/leads/${leadId}`, {
    body: JSON.stringify(values),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  }).then((response) => parseJsonResponse<{ lead: Lead }>(response));

  return payload.lead;
}

export async function deleteLead(leadId: string) {
  await fetch(`/api/leads/${leadId}`, {
    method: "DELETE",
  }).then((response) => parseJsonResponse<{ ok: boolean }>(response));
}

export async function deleteLeads(leadIds: string[]) {
  const payload = await fetch("/api/leads", {
    body: JSON.stringify({ ids: leadIds }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "DELETE",
  }).then((response) => parseJsonResponse<{ deletedCount: number }>(response));

  return payload.deletedCount;
}

export async function updateLeadsStatus(leadIds: string[], status: LeadStatus) {
  const payload = await fetch("/api/leads", {
    body: JSON.stringify({ ids: leadIds, status }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  }).then((response) => parseJsonResponse<{ updatedCount: number }>(response));

  return payload.updatedCount;
}

export async function fetchLeadNotes(leadId: string) {
  const payload = await fetch(`/api/leads/${leadId}/notes`, {
    cache: "no-store",
  }).then((response) => parseJsonResponse<{ notes: LeadNote[] }>(response));

  return payload.notes;
}

export async function addLeadNote(leadId: string, content: string) {
  const payload = await fetch(`/api/leads/${leadId}/notes`, {
    body: JSON.stringify({ content }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }).then((response) => parseJsonResponse<{ note: LeadNote }>(response));

  return payload.note;
}

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const payload = await fetch(`/api/leads/${leadId}/status`, {
    body: JSON.stringify({ status }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  }).then((response) => parseJsonResponse<{ lead: Lead }>(response));

  return payload.lead;
}
