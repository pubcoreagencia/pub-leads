import type { LeadStatus } from "@/schemas/lead";

export type PipelineColumn = {
  id: LeadStatus;
  title: string;
  description: string;
};

export const pipelineColumns: PipelineColumn[] = [
  { id: "new", title: "Novo", description: "Leads recém adicionados" },
  { id: "qualified", title: "Qualificado", description: "Boa aderência inicial" },
  { id: "contacted", title: "Contatado", description: "Primeiro contato feito" },
  { id: "responded", title: "Respondeu", description: "Lead engajou" },
  { id: "proposal", title: "Proposta", description: "Oferta enviada" },
  { id: "won", title: "Fechado", description: "Negócio ganho" },
  { id: "lost", title: "Perdido", description: "Sem avanço" },
];

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "Novo",
  qualified: "Qualificado",
  contacted: "Contatado",
  responded: "Respondeu",
  proposal: "Proposta",
  won: "Fechado",
  lost: "Perdido",
};

export const leadSourceLabels = {
  openstreetmap: "OpenStreetMap",
  overpass: "Overpass",
  csv: "CSV",
  manual: "Manual",
  google_places: "Google Places",
  cnpj_brasil: "CNPJ Brasil",
  apify_instagram: "Apify Instagram",
  apify_google_search: "Apify Google Search",
  apify_generic: "Apify Generic",
} as const;
