import type { Lead, LeadSource, LeadStatus } from "@/schemas/lead";
import { getLeadQualification } from "@/src/lib/lead-qualification/qualifier";
import { countMessages } from "@/src/lib/turso/lead-messages-repository";
import { listLeads } from "@/src/lib/turso/leads-repository";
import { listRecentSearches } from "@/src/lib/turso/search-logs-repository";
import { getUsageSummary, type UsageSummary } from "@/src/lib/usage/limits";

export type ChartPoint = {
  label: string;
  value: number;
};

export type RecentLeadSummary = {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  status: LeadStatus;
  createdAt: string;
};

export type AnalyticsSummary = {
  totals: {
    leads: number;
    searches: number;
    messages: number;
    won: number;
  };
  conversionRate: number;
  usage: UsageSummary;
  qualification: {
    missingWhatsapp: number;
    possibleWhatsapp: number;
    qualificationRate: number;
    withInstagram: number;
    withSite: number;
  };
  pipeline: ChartPoint[];
  sources: ChartPoint[];
  categories: ChartPoint[];
  searchesByDay: ChartPoint[];
  leadsByDay: ChartPoint[];
  recentLeads: RecentLeadSummary[];
};

const statusOrder: LeadStatus[] = [
  "new",
  "qualified",
  "contacted",
  "responded",
  "proposal",
  "won",
  "lost",
];

const statusLabels: Record<LeadStatus, string> = {
  new: "Novo",
  qualified: "Qualificado",
  contacted: "Contatado",
  responded: "Respondeu",
  proposal: "Proposta",
  won: "Fechado",
  lost: "Perdido",
};

const sourceLabels: Record<LeadSource, string> = {
  csv: "CSV",
  cnpj_brasil: "CNPJ Brasil",
  google_places: "Google Places",
  manual: "Manual",
  openstreetmap: "OpenStreetMap",
  overpass: "Overpass",
};

function dateKey(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function lastDays(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    return dateKey(date.toISOString());
  });
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<T, number>>(
    (counts, item) => {
      counts[item] = (counts[item] ?? 0) + 1;
      return counts;
    },
    {} as Record<T, number>,
  );
}

function countByDay(items: Array<{ created_at: string }>, days = 7) {
  const labels = lastDays(days);
  const counts = new Map(labels.map((label) => [label, 0]));

  items.forEach((item) => {
    const label = dateKey(item.created_at);

    if (counts.has(label)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  });

  return labels.map((label) => ({
    label,
    value: counts.get(label) ?? 0,
  }));
}

function topCategories(leads: Lead[]) {
  const counts = new Map<string, number>();

  leads.forEach((lead) => {
    const category = lead.category || "Sem categoria";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));
}

export async function getAnalyticsSummary(
  userId: string,
  userEmail?: string | null,
): Promise<AnalyticsSummary> {
  const usage = await getUsageSummary(userId, userEmail);
  const [leads, messagesCount, searches] = await Promise.all([
    listLeads(userId, { limit: 5000 }),
    countMessages(userId),
    listRecentSearches(userId, 1000),
  ]);
  const statusCounts = countBy(leads.map((lead) => lead.status));
  const sourceCounts = countBy(leads.map((lead) => lead.source));
  const qualifications = leads.map((lead) => getLeadQualification(lead));
  const won = statusCounts.won ?? 0;
  const conversionRate = leads.length > 0 ? Math.round((won / leads.length) * 100) : 0;
  const possibleWhatsapp = qualifications.filter((qualification) =>
    ["confirmed", "possible"].includes(qualification.whatsapp_status),
  ).length;
  const missingWhatsapp = qualifications.filter((qualification) =>
    ["missing", "invalid"].includes(qualification.whatsapp_status),
  ).length;
  const withInstagram = qualifications.filter(
    (qualification) => qualification.instagram_status === "found",
  ).length;
  const withSite = leads.filter((lead) => Boolean(lead.website)).length;
  const qualified = qualifications.filter(
    (qualification) =>
      qualification.instagram_status === "found" ||
      qualification.whatsapp_status === "confirmed" ||
      qualification.whatsapp_status === "possible",
  ).length;

  return {
    categories: topCategories(leads),
    conversionRate,
    leadsByDay: countByDay(leads),
    pipeline: statusOrder.map((status) => ({
      label: statusLabels[status],
      value: statusCounts[status] ?? 0,
    })),
    qualification: {
      missingWhatsapp,
      possibleWhatsapp,
      qualificationRate: leads.length > 0 ? Math.round((qualified / leads.length) * 100) : 0,
      withInstagram,
      withSite,
    },
    recentLeads: leads.slice(0, 6).map((lead) => ({
      category: lead.category,
      city: lead.city,
      createdAt: lead.created_at,
      id: lead.id,
      name: lead.name,
      status: lead.status,
    })),
    searchesByDay: countByDay(searches),
    sources: (Object.keys(sourceLabels) as LeadSource[]).map((source) => ({
      label: sourceLabels[source],
      value: sourceCounts[source] ?? 0,
    })),
    totals: {
      leads: leads.length,
      messages: messagesCount,
      searches: searches.length,
      won,
    },
    usage,
  };
}
