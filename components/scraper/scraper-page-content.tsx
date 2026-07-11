"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ExternalLink,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadCategories, type LeadCategoryId } from "@/config/lead-categories";
import { toast } from "@/hooks/use-toast";
import {
  getLeadQualification,
  qualifyLeadAfterScraping,
  type LeadQualification,
} from "@/src/lib/lead-qualification/qualifier";
import { PageHeader } from "@/components/ops/page";
import type { ExternalLead, NormalizedLead } from "@/src/lib/lead-sources/types";
import { createWaLink } from "@/src/lib/whatsapp/wa-link";

type LeadSearchSource = "site_sales" | "openstreetmap" | "cnpj_brasil" | "google_places" | "apify_google_maps";
type QualificationFilter =
  | "all"
  | "confirmed_whatsapp"
  | "possible_whatsapp"
  | "landline"
  | "missing_whatsapp"
  | "with_instagram"
  | "missing_instagram"
  | "with_site"
  | "without_site"
  | "saved"
  | "not_saved"
  | "best";

type SearchResultLead = (ExternalLead | NormalizedLead) & {
  qualification?: LeadQualification;
  saved?: boolean;
  savedLeadId?: string | null;
  selected?: boolean;
  sessionResultId?: string;
};

type ScrapingSession = {
  apify_run_id: string | null;
  city: string | null;
  created_at: string;
  error_message: string | null;
  filters: Record<string, unknown>;
  id: string;
  niche: string | null;
  requested_limit: number | null;
  results_count: number;
  selected_count: number;
  source: string;
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  updated_at: string;
};

type ScrapingSessionPayload = {
  results: SearchResultLead[];
  session: ScrapingSession | null;
};

type SearchFormState = {
  source: LeadSearchSource;
  city: string;
  state: string;
  country: string;
  category: LeadCategoryId;
  radiusKm: string;
  limit: string;
  onlyWithPhone: boolean;
  onlyWithWebsite: boolean;
  onlyWithoutWebsite: boolean;
};

type ScraperPageContentProps = {
  canSelectSource: boolean;
  googlePlacesEnabled: boolean;
};

type ApifyAvailability = {
  available: boolean;
  monthlyBudgetUsd?: number;
  reason?: "missing_token" | "not_internal_user" | "budget_exceeded" | "ok";
  usedBudgetUsd?: number;
};

type ApifySourceDefinition = {
  category: "google_maps" | "instagram" | "google_search" | "generic";
  description?: string | null;
  enabled: boolean;
  estimatedCostLabel?: string;
  id: string;
  isRecommended: boolean;
  kind: "actor" | "task";
  name: string;
  supportedUse?: string;
};

type ApifySourcesPayload = ApifyAvailability & {
  sources: ApifySourceDefinition[];
};

const initialForm: SearchFormState = {
  source: "site_sales",
  city: "",
  state: "",
  country: "Brasil",
  category: "restaurante",
  radiusKm: "5",
  limit: "25",
  onlyWithPhone: true,
  onlyWithWebsite: false,
  onlyWithoutWebsite: true,
};

const sourceLabels: Record<string, string> = {
  apify_generic: "Apify",
  apify_google_search: "Apify Google Search",
  apify_instagram: "Apify Instagram",
  cnpj_brasil: "CNPJ Brasil",
  google_places: "Google Places oficial",
  apify_google_maps: "Apify",
  openstreetmap: "OpenStreetMap/Overpass",
  site_sales: "Venda de Sites",
};

const sourceHints: Record<LeadSearchSource, string> = {
  cnpj_brasil: "Fonte gratuita principal; exige importar os arquivos oficiais da Receita Federal.",
  google_places: "Requer chave da API oficial do Google Maps Platform.",
  apify_google_maps: "Fonte premium controlada por orçamento mensal e limite de resultados.",
  openstreetmap: "Complemento gratuito com cobertura variavel por cidade.",
  site_sales: "Busca CNPJ + OpenStreetMap, priorizando telefone e ausencia de site.",
};

const scraperSteps = [
  { label: "Configurar", description: "Cidade, nicho e limite" },
  { label: "Buscar", description: "Scraping e sessão temporária" },
  { label: "Qualificar", description: "WhatsApp, Instagram e site" },
  { label: "Filtrar", description: "Priorizar melhores leads" },
  { label: "Salvar", description: "Enviar para CRM" },
];

const qualificationFilterLabels: Record<QualificationFilter, string> = {
  all: "Todos",
  best: "Melhores qualificados",
  confirmed_whatsapp: "WhatsApp confirmado",
  landline: "Telefone fixo",
  missing_whatsapp: "Sem WhatsApp",
  missing_instagram: "Sem Instagram",
  not_saved: "Nao salvos",
  possible_whatsapp: "Com possivel WhatsApp",
  saved: "Salvos",
  with_instagram: "Com Instagram",
  with_site: "Com site",
  without_site: "Sem site",
};

function getLeadIdentifier(lead: SearchResultLead) {
  return "externalId" in lead ? lead.externalId : lead.sourcePlaceId;
}

function getCoordinateLabel(lead: SearchResultLead) {
  if (typeof lead.latitude !== "number" || typeof lead.longitude !== "number") {
    return null;
  }

  return `${lead.latitude.toFixed(6)}, ${lead.longitude.toFixed(6)}`;
}

function whatsappBadge(qualification: LeadQualification) {
  if (qualification.whatsapp_status === "confirmed") {
    return {
      className: "bg-emerald-50 text-emerald-700",
      label: "WhatsApp confirmado",
    };
  }

  if (qualification.whatsapp_status === "possible") {
    return {
      className: "bg-blue-50 text-blue-700",
      label: "Possivel WhatsApp",
    };
  }

  if (qualification.whatsapp_status === "landline") {
    return {
      className: "bg-amber-50 text-amber-800",
      label: "Telefone fixo",
    };
  }

  if (qualification.whatsapp_status === "invalid") {
    return {
      className: "bg-red-50 text-red-700",
      label: "Telefone invalido",
    };
  }

  return {
    className: "bg-slate-100 text-slate-700",
    label: "Sem WhatsApp",
  };
}

function instagramBadge(qualification: LeadQualification) {
  if (qualification.instagram_status === "found") {
    return {
      className: "bg-pink-50 text-pink-700",
      label: "Instagram",
    };
  }

  if (qualification.instagram_status === "missing") {
    return {
      className: "bg-slate-100 text-slate-700",
      label: "Sem Instagram",
    };
  }

  return {
    className: "bg-amber-50 text-amber-700",
    label: "Instagram nao verificado",
  };
}

async function parseJsonResponse<T>(response: Response) {
  const rawBody = await response.text();
  let payload: (T & { error?: string }) | null = null;

  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody) as T & { error?: string };
    } catch {
      throw new Error(
        response.ok
          ? "A API retornou uma resposta invalida."
          : `A API retornou uma resposta invalida (${response.status}).`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? "Nao foi possivel concluir a operacao.");
  }

  if (!payload) {
    throw new Error("A API retornou uma resposta vazia.");
  }

  return payload;
}

function getContactPhone(lead: SearchResultLead) {
  return lead.phone ?? lead.phone2 ?? null;
}

function getWhatsAppHref(lead: SearchResultLead) {
  const qualification = getLeadQualification(lead);

  if (!["confirmed", "possible"].includes(qualification.whatsapp_status)) {
    return null;
  }

  const phone = qualification.normalized_whatsapp;

  if (!phone) {
    return null;
  }

  try {
    return createWaLink({ phone, message: "" });
  } catch {
    return null;
  }
}

export function ScraperPageContent({ canSelectSource, googlePlacesEnabled }: ScraperPageContentProps) {
  const [form, setForm] = useState<SearchFormState>(initialForm);
  const [results, setResults] = useState<SearchResultLead[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isQualifyingInstagram, setIsQualifyingInstagram] = useState(false);
  const [qualificationFilter, setQualificationFilter] = useState<QualificationFilter>("all");
  const [qualificationProgress, setQualificationProgress] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [apifyAvailability, setApifyAvailability] = useState<ApifyAvailability>({ available: false });
  const [apifySources, setApifySources] = useState<ApifySourceDefinition[]>([]);
  const [selectedApifySourceId, setSelectedApifySourceId] = useState("");
  const [isSyncingApifySources, setIsSyncingApifySources] = useState(false);
  const [currentSession, setCurrentSession] = useState<ScrapingSession | null>(null);
  const [isDiscardingSession, setIsDiscardingSession] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const selectedApifySource = useMemo(
    () => apifySources.find((source) => source.id === selectedApifySourceId) ?? null,
    [apifySources, selectedApifySourceId],
  );
  const apifyEnabled = apifyAvailability.available && apifySources.some((source) => source.enabled);

  useEffect(() => {
    let active = true;
    fetch("/api/lead-sources/apify/sources", { cache: "no-store" })
      .then(async (response) => ({ payload: await response.json() as ApifySourcesPayload, response }))
      .then(({ payload }) => {
        if (!active) return;

        setApifyAvailability(payload);
        setApifySources(Array.isArray(payload.sources) ? payload.sources : []);
        setSelectedApifySourceId((current) => {
          if (current && payload.sources?.some((source) => source.id === current && source.enabled)) {
            return current;
          }

          const nextSource =
            payload.sources?.find((source) => source.enabled && source.isRecommended) ??
            payload.sources?.find((source) => source.enabled);

          return nextSource?.id ?? "";
        });
      })
      .catch(() => {
        if (active) {
          setApifyAvailability({ available: false, reason: "missing_token" });
          setApifySources([]);
          setSelectedApifySourceId("");
        }
      });
    return () => { active = false; };
  }, []);

  function applySessionPayload(payload: ScrapingSessionPayload) {
    setCurrentSession(payload.session);
    setResults(payload.results.map((lead) => qualifyLeadAfterScraping(lead)));
    setSelectedResultIds(new Set(payload.results.filter((lead) => lead.selected && !lead.saved).map(getLeadIdentifier)));
    setHasSearched(Boolean(payload.session) || payload.results.length > 0);

    if (payload.session) {
      const source = payload.session.source as LeadSearchSource;
      const filters = payload.session.filters ?? {};
      const nextFilter =
        typeof filters.qualificationFilter === "string"
          ? filters.qualificationFilter as QualificationFilter
          : "all";
      const nextApifySourceId =
        typeof filters.apifySourceId === "string" ? filters.apifySourceId : null;

      if (nextFilter in qualificationFilterLabels) {
        setQualificationFilter(nextFilter);
      }

      if (nextApifySourceId) {
        setSelectedApifySourceId(nextApifySourceId);
      }

      setForm((current) => ({
        ...current,
        city: payload.session?.city ?? current.city,
        limit: payload.session?.requested_limit ? String(payload.session.requested_limit) : current.limit,
        source: source in sourceLabels ? source : current.source,
      }));

      if (payload.session.status === "running") {
        setQualificationProgress("Busca em andamento. Os resultados serao restaurados automaticamente quando terminarem.");
      } else if (payload.session.status === "failed" && payload.session.error_message) {
        setQualificationProgress(payload.session.error_message);
      }
    }
  }

  async function refreshCurrentSession() {
    const payload = await fetch("/api/scraping-sessions/current", { cache: "no-store" })
      .then((response) => parseJsonResponse<ScrapingSessionPayload>(response));
    applySessionPayload(payload);
  }

  useEffect(() => {
    let active = true;
    setIsLoadingSession(true);
    fetch("/api/scraping-sessions/current", { cache: "no-store" })
      .then((response) => parseJsonResponse<ScrapingSessionPayload>(response))
      .then((payload) => {
        if (active) {
          applySessionPayload(payload);
        }
      })
      .catch(() => {
        if (active) {
          setCurrentSession(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentSession?.apify_run_id || currentSession.status !== "running") {
      return;
    }

    let active = true;
    const runId = currentSession.apify_run_id;

    async function pollRun() {
      try {
        const runState = await fetch(`/api/lead-sources/apify/runs/${runId}`)
          .then((response) => parseJsonResponse<{ run: { status: string } }>(response));

        if (!active) {
          return;
        }

        if (runState.run.status === "failed" || runState.run.status === "aborted") {
          await refreshCurrentSession();
          setIsSearching(false);
          return;
        }

        if (runState.run.status === "succeeded") {
          const imported = await fetch(`/api/lead-sources/apify/runs/${runId}/import`, { method: "POST" })
            .then((response) => parseJsonResponse<ScrapingSessionPayload>(response));

          if (!active) {
            return;
          }

          applySessionPayload(imported);
          setIsSearching(false);
          setQualificationProgress("Dataset Apify importado.");
          toast({
            title: "Busca Apify concluida",
            description: `${imported.results.length} leads encontrados.`,
            variant: "success",
          });
        }
      } catch {
        if (active) {
          setIsSearching(false);
        }
      }
    }

    setIsSearching(true);
    void pollRun();
    const interval = window.setInterval(() => {
      void pollRun();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.apify_run_id, currentSession?.status]);

  const visibleResults = useMemo(
    () =>
      results.filter((lead) => {
        const qualification = getLeadQualification(lead);

        if (qualificationFilter === "possible_whatsapp") {
          return qualification.whatsapp_status === "possible";
        }

        if (qualificationFilter === "confirmed_whatsapp") {
          return qualification.whatsapp_status === "confirmed";
        }

        if (qualificationFilter === "landline") {
          return qualification.whatsapp_status === "landline";
        }

        if (qualificationFilter === "missing_whatsapp") {
          return qualification.whatsapp_status === "missing" || qualification.whatsapp_status === "invalid";
        }

        if (qualificationFilter === "with_instagram") {
          return qualification.instagram_status === "found";
        }

        if (qualificationFilter === "missing_instagram") {
          return qualification.instagram_status === "missing";
        }

        if (qualificationFilter === "with_site") {
          return Boolean(lead.website);
        }

        if (qualificationFilter === "without_site") {
          return !lead.website;
        }

        if (qualificationFilter === "best") {
          return (
            qualification.qualification_score >= 35 ||
            qualification.instagram_status === "found" ||
            qualification.whatsapp_status === "confirmed" ||
            qualification.whatsapp_status === "possible"
          );
        }

        if (qualificationFilter === "saved") {
          return Boolean(lead.saved);
        }

        if (qualificationFilter === "not_saved") {
          return !lead.saved;
        }

        return true;
      }),
    [qualificationFilter, results],
  );
  const unsavedVisibleResults = useMemo(
    () => visibleResults.filter((lead) => !lead.saved),
    [visibleResults],
  );
  const selectedUnsavedResults = useMemo(
    () => unsavedVisibleResults.filter((lead) => selectedResultIds.has(getLeadIdentifier(lead))),
    [selectedResultIds, unsavedVisibleResults],
  );

  function updateField<K extends keyof SearchFormState>(field: K, value: SearchFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSourceChange(source: LeadSearchSource) {
    if (!canSelectSource) {
      return;
    }

    if (source === "google_places" && !googlePlacesEnabled) {
      toast({
        title: "Google Places indisponivel",
        description: "Essa fonte requer GOOGLE_PLACES_API_KEY ou GOOGLE_MAPS_API_KEY configurada.",
        variant: "error",
      });
      return;
    }

    if (source === "apify_google_maps" && !apifyEnabled) {
      toast({ title: "Apify indisponível", description: "Essa fonte requer APIFY_TOKEN configurado no servidor.", variant: "error" });
      return;
    }

    setForm((current) => ({
      ...current,
      onlyWithPhone: source === "site_sales" ? true : current.onlyWithPhone,
      onlyWithoutWebsite: source === "site_sales" ? true : current.onlyWithoutWebsite,
      source,
    }));
  }

  async function handleSyncApifySources() {
    setIsSyncingApifySources(true);

    try {
      const payload = await fetch("/api/lead-sources/apify/sources/sync", { method: "POST" })
        .then((response) => parseJsonResponse<{ sources: ApifySourceDefinition[] }>(response));

      setApifySources(payload.sources);
      setSelectedApifySourceId((current) => {
        if (current && payload.sources.some((source) => source.id === current && source.enabled)) {
          return current;
        }

        const nextSource =
          payload.sources.find((source) => source.enabled && source.isRecommended) ??
          payload.sources.find((source) => source.enabled);

        return nextSource?.id ?? "";
      });
      setApifyAvailability((current) => ({
        ...current,
        available: payload.sources.some((source) => source.enabled) && current.reason !== "budget_exceeded",
        reason: payload.sources.some((source) => source.enabled) ? current.reason ?? "ok" : current.reason,
      }));
      toast({
        title: "Fontes Apify atualizadas",
        description: `${payload.sources.length} fontes encontradas na conta conectada.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Nao foi possivel atualizar Apify",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSyncingApifySources(false);
    }
  }

  async function createSearchSession(status: ScrapingSession["status"]) {
    const category = leadCategories.find((item) => item.id === form.category);
    const payload = await fetch("/api/scraping-sessions", {
      body: JSON.stringify({
        city: form.city,
        filters: { apifySourceId: selectedApifySourceId || null, form, qualificationFilter },
        niche: category?.label ?? form.category,
        query: category?.label ?? form.category,
        requested_limit: Number(form.limit),
        source: form.source,
        status,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then((response) => parseJsonResponse<{ session: ScrapingSession }>(response));

    setCurrentSession(payload.session);
    return payload.session;
  }

  async function updateSearchSession(sessionId: string, data: Partial<ScrapingSession>) {
    const payload = await fetch(`/api/scraping-sessions/${sessionId}`, {
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }).then((response) => parseJsonResponse<ScrapingSessionPayload>(response));
    applySessionPayload(payload);
    return payload;
  }

  async function persistSessionResults(sessionId: string, leads: SearchResultLead[]) {
    const payload = await fetch(`/api/scraping-sessions/${sessionId}/results`, {
      body: JSON.stringify({ leads }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then((response) => parseJsonResponse<ScrapingSessionPayload>(response));
    applySessionPayload(payload);
    return payload;
  }

  function hasUnsavedTemporaryResults() {
    return results.some((lead) => !lead.saved);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      currentSession &&
      hasUnsavedTemporaryResults() &&
      !window.confirm(`Voce tem uma busca anterior com ${results.filter((lead) => !lead.saved).length} resultados nao salvos. Deseja substituir?`)
    ) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setResults([]);
    setSelectedResultIds(new Set());

    try {
      const category = leadCategories.find((item) => item.id === form.category);
      if (form.source === "google_places" && !googlePlacesEnabled) {
        throw new Error("Google Places requer chave de API configurada.");
      }

      const limit = Math.min(Number(form.limit), form.source === "google_places" ? 60 : 100);
      await createSearchSession("running");
      if (form.source === "apify_google_maps") {
        if (!selectedApifySourceId) {
          throw new Error("Selecione uma fonte Apify disponivel.");
        }

        const query = [category?.label ?? form.category, form.city, form.state, form.country]
          .filter(Boolean)
          .join(" ");
        const started = await fetch("/api/lead-sources/apify/run/start", {
          body: JSON.stringify({
            city: form.city,
            input: { query },
            niche: category?.label ?? form.category,
            requestedLimit: limit,
            sourceId: selectedApifySourceId,
            state: form.state,
          }),
          headers: { "Content-Type": "application/json" }, method: "POST",
        }).then((response) => parseJsonResponse<{ budget: { limit: number; spent: number; estimated: number }; run: { run_id: string } }>(response));
        setQualificationProgress(`Apify em execução. Orçamento: US$ ${started.budget.spent.toFixed(2)} de US$ ${started.budget.limit.toFixed(2)}; estimativa US$ ${started.budget.estimated.toFixed(2)}.`);
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const runState = await fetch(`/api/lead-sources/apify/runs/${started.run.run_id}`).then((response) => parseJsonResponse<{ run: { status: string } }>(response));
          if (runState.run.status === "failed" || runState.run.status === "aborted") throw new Error("A execução Apify não foi concluída.");
          if (runState.run.status === "succeeded") {
            const imported = await fetch(`/api/lead-sources/apify/runs/${started.run.run_id}/import`, { method: "POST" }).then((response) => parseJsonResponse<{ results: SearchResultLead[] }>(response));
            setResults(imported.results.map((lead) => qualifyLeadAfterScraping(lead)));
            setQualificationFilter("all"); setQualificationProgress("Dataset Apify importado.");
            toast({ title: "Busca Apify concluída", description: `${imported.results.length} leads encontrados.`, variant: "success" });
            return;
          }
        }
        throw new Error("A execução Apify continua em andamento. Tente novamente em alguns instantes.");
      }

      const endpointBySource: Record<Exclude<LeadSearchSource, "apify_google_maps">, string> = {
        cnpj_brasil: "/api/lead-sources/cnpj/search",
        google_places: "/api/lead-sources/google-places",
        openstreetmap: "/api/lead-sources/overpass",
        site_sales: "/api/lead-sources/site-sales/search",
      };
      const endpoint = endpointBySource[form.source];
      const payload =
        form.source === "cnpj_brasil"
          ? {
              city: form.city,
              limit,
              onlyWithPhone: form.onlyWithPhone,
              query: category?.label ?? form.category,
              state: form.state,
            }
          : form.source === "google_places"
            ? {
                category: form.category,
                city: form.city,
                country: form.country,
                limit,
                onlyWithPhone: form.onlyWithPhone,
                onlyWithWebsite: form.onlyWithWebsite,
                radiusKm: Number(form.radiusKm),
                state: form.state,
              }
          : form.source === "site_sales"
            ? {
                category: form.category,
                city: form.city,
                country: form.country,
                limit,
                onlyWithPhone: form.onlyWithPhone,
                onlyWithoutWebsite: form.onlyWithoutWebsite,
                radiusKm: Number(form.radiusKm),
                state: form.state,
              }
          : {
              category: form.category,
              city: form.city,
              country: form.country,
              limit,
              radiusKm: Number(form.radiusKm),
              state: form.state,
            };

      const data = await fetch(endpoint, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }).then((response) =>
        parseJsonResponse<{ results: SearchResultLead[]; warnings?: string[] }>(response),
      );

      setResults(data.results.map((lead) => qualifyLeadAfterScraping(lead)));
      setQualificationFilter("all");
      const warnings = data.warnings ?? [];
      toast({
        title: "Busca concluida",
        description:
          warnings.length > 0
            ? `${data.results.length} leads encontrados. Aviso: ${warnings[0]}`
            : `${data.results.length} leads encontrados em ${sourceLabels[form.source]}.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSearchWithSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      currentSession &&
      hasUnsavedTemporaryResults() &&
      !window.confirm(`Voce tem uma busca anterior com ${results.filter((lead) => !lead.saved).length} resultados nao salvos. Deseja substituir?`)
    ) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setResults([]);
    setSelectedResultIds(new Set());

    let session: ScrapingSession | null = null;

    try {
      const category = leadCategories.find((item) => item.id === form.category);
      if (form.source === "google_places" && !googlePlacesEnabled) {
        throw new Error("Google Places requer chave de API configurada.");
      }

      const limit = Math.min(Number(form.limit), form.source === "google_places" ? 60 : 100);
      session = await createSearchSession("running");

      if (form.source === "apify_google_maps") {
        if (!selectedApifySourceId) {
          throw new Error("Selecione uma fonte Apify disponivel.");
        }

        const query = [category?.label ?? form.category, form.city, form.state, form.country]
          .filter(Boolean)
          .join(" ");
        const started = await fetch("/api/lead-sources/apify/run/start", {
          body: JSON.stringify({
            city: form.city,
            input: { query },
            niche: category?.label ?? form.category,
            requestedLimit: limit,
            sessionId: session.id,
            sourceId: selectedApifySourceId,
            state: form.state,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }).then((response) =>
          parseJsonResponse<{
            budget: { estimated: number; limit: number; spent: number };
            run: { run_id: string };
            source: ApifySourceDefinition;
          }>(response),
        );

        await updateSearchSession(session.id, { apify_run_id: started.run.run_id, status: "running" });
        setQualificationProgress(`Apify em execucao. Orcamento: US$ ${started.budget.spent.toFixed(2)} de US$ ${started.budget.limit.toFixed(2)}; estimativa US$ ${started.budget.estimated.toFixed(2)}.`);
        toast({
          title: "Busca Apify iniciada",
          description: `${started.source.name} esta rodando. Voce pode sair desta tela; a busca sera restaurada ao voltar.`,
          variant: "success",
        });
        return;
      }

      const endpointBySource: Record<Exclude<LeadSearchSource, "apify_google_maps">, string> = {
        cnpj_brasil: "/api/lead-sources/cnpj/search",
        google_places: "/api/lead-sources/google-places",
        openstreetmap: "/api/lead-sources/overpass",
        site_sales: "/api/lead-sources/site-sales/search",
      };
      const endpoint = endpointBySource[form.source];
      const payload =
        form.source === "cnpj_brasil"
          ? {
              city: form.city,
              limit,
              onlyWithPhone: form.onlyWithPhone,
              query: category?.label ?? form.category,
              state: form.state,
            }
          : form.source === "google_places"
            ? {
                category: form.category,
                city: form.city,
                country: form.country,
                limit,
                onlyWithPhone: form.onlyWithPhone,
                onlyWithWebsite: form.onlyWithWebsite,
                radiusKm: Number(form.radiusKm),
                state: form.state,
              }
          : form.source === "site_sales"
            ? {
                category: form.category,
                city: form.city,
                country: form.country,
                limit,
                onlyWithPhone: form.onlyWithPhone,
                onlyWithoutWebsite: form.onlyWithoutWebsite,
                radiusKm: Number(form.radiusKm),
                state: form.state,
              }
          : {
              category: form.category,
              city: form.city,
              country: form.country,
              limit,
              radiusKm: Number(form.radiusKm),
              state: form.state,
            };

      const data = await fetch(endpoint, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }).then((response) =>
        parseJsonResponse<{ results: SearchResultLead[]; warnings?: string[] }>(response),
      );

      const qualifiedResults = data.results.map((lead) => qualifyLeadAfterScraping(lead));
      await persistSessionResults(session.id, qualifiedResults);
      await updateSearchSession(session.id, { results_count: qualifiedResults.length, status: "completed" });
      setQualificationFilter("all");

      const warnings = data.warnings ?? [];
      toast({
        title: "Busca concluida",
        description:
          warnings.length > 0
            ? `${data.results.length} leads encontrados. Aviso: ${warnings[0]}`
            : `${data.results.length} leads encontrados em ${sourceLabels[form.source]}.`,
        variant: "success",
      });
    } catch (error) {
      if (session) {
        await updateSearchSession(session.id, {
          error_message: error instanceof Error ? error.message : "Tente novamente.",
          status: "failed",
        }).catch(() => undefined);
      }
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function saveLeads(leads: SearchResultLead[]) {
    const sessionResultIds = leads
      .map((lead) => lead.sessionResultId)
      .filter((id): id is string => Boolean(id));

    if (currentSession && sessionResultIds.length > 0) {
      const data = await fetch(`/api/scraping-sessions/${currentSession.id}/save-leads`, {
        body: JSON.stringify({ resultIds: sessionResultIds }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }).then(
        (response) =>
          parseJsonResponse<ScrapingSessionPayload & {
            savedExternalIds: string[];
            skippedExternalIds: string[];
          }>(response),
      );

      applySessionPayload(data);
      return data;
    }

    const data = await fetch("/api/leads/save", {
      body: JSON.stringify({ leads }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }).then(
      (response) =>
        parseJsonResponse<{
          savedExternalIds: string[];
          skippedExternalIds: string[];
        }>(response),
    );

    const savedIds = new Set([...data.savedExternalIds, ...data.skippedExternalIds]);
    setResults((current) =>
      current.map((lead) =>
        savedIds.has(getLeadIdentifier(lead)) ? { ...lead, saved: true } : lead,
      ),
    );

    return data;
  }

  async function handleQualifyContacts() {
    const leadsToQualify = results.filter((lead) => {
      const qualification = getLeadQualification(lead);

      return (
        Boolean(lead.website) &&
        (qualification.instagram_status !== "found" || qualification.whatsapp_status !== "confirmed")
      );
    });

    if (leadsToQualify.length === 0) {
      toast({
        title: "Nada para qualificar",
        description: "Nenhum lead com site disponivel para buscar contatos publicos.",
        variant: "error",
      });
      return;
    }

    setIsQualifyingInstagram(true);
    setQualificationProgress(`Qualificando 0/${leadsToQualify.length}`);

    try {
      const updates = new Map<
        string,
        {
          email: string | null;
          phone: string | null;
          qualification: LeadQualification;
          rawData: Record<string, unknown>;
        }
      >();

      for (let index = 0; index < leadsToQualify.length; index += 25) {
        const chunk = leadsToQualify.slice(index, index + 25);
        const payload = await fetch("/api/lead-qualification/instagram", {
          body: JSON.stringify({
            leads: chunk.map((lead) => ({
              id: getLeadIdentifier(lead),
              name: lead.name,
              phone: lead.phone,
              phone2: lead.phone2,
              qualification: lead.qualification,
              raw: "raw" in lead ? lead.raw : undefined,
              rawData: lead.rawData,
              website: lead.website,
            })),
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }).then((response) =>
          parseJsonResponse<{
            results: Array<{
              email: string | null;
              id: string;
              phone: string | null;
              qualification: LeadQualification;
              rawData: Record<string, unknown>;
            }>;
          }>(response),
        );

        payload.results.forEach((result) => {
          updates.set(result.id, {
            email: result.email,
            phone: result.phone,
            qualification: result.qualification,
            rawData: result.rawData,
          });
        });
        setQualificationProgress(
          `Qualificando ${Math.min(index + chunk.length, leadsToQualify.length)}/${leadsToQualify.length}`,
        );
      }

      const updatedResults = results.map((lead) => {
          const update = updates.get(getLeadIdentifier(lead));

          return update
            ? {
                ...lead,
                email: lead.email ?? update.email,
                phone: lead.phone ?? update.phone,
                qualification: update.qualification,
                rawData: update.rawData,
              }
            : lead;
        });
      setResults(updatedResults);
      if (currentSession) {
        await fetch(`/api/scraping-sessions/${currentSession.id}/results`, {
          body: JSON.stringify({ leads: updatedResults.filter((lead) => updates.has(getLeadIdentifier(lead))) }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }).then((response) => parseJsonResponse<ScrapingSessionPayload>(response))
          .then(applySessionPayload);
      }
      toast({
        title: "Qualificacao concluida",
        description: "Busca publica por Instagram, WhatsApp, telefone e email finalizada.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao qualificar contatos",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsQualifyingInstagram(false);
      setQualificationProgress("");
    }
  }

  async function handleSaveLead(lead: SearchResultLead) {
    const leadId = getLeadIdentifier(lead);
    setSavingIds((current) => new Set(current).add(leadId));

    try {
      await saveLeads([lead]);
      toast({ title: "Lead salvo", variant: "success" });
    } catch (error) {
      toast({
        title: "Erro ao salvar lead",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(leadId);
        return next;
      });
    }
  }

  async function handleSaveVisible() {
    const leadsToSave = selectedUnsavedResults.length > 0 ? selectedUnsavedResults : unsavedVisibleResults;

    if (leadsToSave.length === 0) {
      return;
    }

    setIsSavingAll(true);

    try {
      const data = await saveLeads(leadsToSave);
      setSelectedResultIds(new Set());
      toast({
        title: "Leads salvos",
        description: `${data.savedExternalIds.length} novos leads salvos. ${data.skippedExternalIds.length} duplicados ignorados.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar resultados",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSavingAll(false);
    }
  }

  async function handleDiscardSession() {
    if (!currentSession || !window.confirm("Descartar os resultados temporarios desta busca? Leads ja salvos permanecem em Leads.")) {
      return;
    }

    setIsDiscardingSession(true);

    try {
      await fetch(`/api/scraping-sessions/${currentSession.id}`, { method: "DELETE" })
        .then((response) => parseJsonResponse<{ ok: boolean }>(response));
      setCurrentSession(null);
      setResults([]);
      setSelectedResultIds(new Set());
      setHasSearched(false);
      setQualificationProgress("");
      toast({ title: "Busca temporaria descartada", variant: "success" });
    } catch (error) {
      toast({
        title: "Erro ao descartar busca",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsDiscardingSession(false);
    }
  }

  function toggleResultSelection(lead: SearchResultLead, checked: boolean) {
    const id = getLeadIdentifier(lead);

    setSelectedResultIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });

    if (currentSession && lead.sessionResultId) {
      void fetch(`/api/scraping-sessions/${currentSession.id}/results`, {
        body: JSON.stringify({ resultIds: [lead.sessionResultId], selected: checked }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      })
        .then((response) => parseJsonResponse<ScrapingSessionPayload>(response))
        .then(({ session }) => {
          if (session) {
            setCurrentSession(session);
          }
        })
        .catch(() => {
          toast({
            title: "Selecao nao salva",
            description: "A selecao local foi mantida, mas nao foi sincronizada.",
            variant: "error",
          });
        });
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        actions={(
          <Button
            disabled={unsavedVisibleResults.length === 0 || isSavingAll}
            onClick={handleSaveVisible}
            type="button"
          >
            {isSavingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {selectedUnsavedResults.length > 0
              ? `Salvar ${selectedUnsavedResults.length} selecionados`
              : qualificationFilter === "all"
                ? "Salvar resultados"
                : "Salvar filtrados"}
          </Button>
        )}
        description="Configure uma busca, rode o scraping, qualifique canais e salve apenas as oportunidades uteis."
        eyebrow="Fluxo de prospeccao"
        title="Prospecção de leads"
      />

      <div className="grid gap-3 md:grid-cols-5">
        {scraperSteps.map((step, index) => {
          const active =
            (index === 0 && !hasSearched) ||
            (index === 1 && isSearching) ||
            (index === 2 && results.length > 0 && qualificationFilter === "all") ||
            (index === 3 && results.length > 0 && qualificationFilter !== "all") ||
            (index === 4 && selectedUnsavedResults.length > 0);

          return (
            <div
              className={`rounded-lg border p-4 ${active ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
              key={step.label}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {index + 1}
                </span>
                <p className="text-sm font-semibold text-slate-950">{step.label}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{step.description}</p>
            </div>
          );
        })}
      </div>

      {isLoadingSession ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-red-600" />
          Restaurando ultima busca...
        </div>
      ) : currentSession ? (
        <div className="rounded-lg border border-red-100 bg-red-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-red-950">
                  {currentSession.status === "running" ? "Busca em andamento" : "Ultima busca"}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-red-700">
                  Busca salva automaticamente
                </span>
                {currentSession.status === "failed" ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    Falhou
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-6 text-red-900/80">
                Os resultados desta busca ficam salvos temporariamente ate voce salvar ou descartar.
              </p>
              <p className="mt-1 text-xs text-red-800/70">
                {sourceLabels[(currentSession.source as LeadSearchSource)] ?? currentSession.source}
                {currentSession.city ? ` em ${currentSession.city}` : ""} · {results.filter((lead) => lead.saved).length} salvos / {results.filter((lead) => !lead.saved).length} pendentes
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => void refreshCurrentSession()} type="button" variant="outline">
                Continuar busca anterior
              </Button>
              <Button
                disabled={isDiscardingSession}
                onClick={handleDiscardSession}
                type="button"
                variant="outline"
              >
                {isDiscardingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Descartar busca
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Parâmetros da busca</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-12" onSubmit={handleSearchWithSession}>
            {canSelectSource ? (
              <div className="grid gap-2 xl:col-span-3">
                <Label htmlFor="source">Fonte de teste</Label>
                <select
                  className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  id="source"
                  onChange={(event) => handleSourceChange(event.target.value as LeadSearchSource)}
                  value={form.source}
                >
                  <option value="site_sales">Venda de Sites (CNPJ + OSM)</option>
                  <option value="cnpj_brasil">CNPJ Brasil</option>
                  <option value="openstreetmap">OpenStreetMap/Overpass</option>
                  <option disabled={!googlePlacesEnabled} value="google_places">
                    {googlePlacesEnabled ? "Google Places oficial" : "Google Places (requer API key)"}
                  </option>
                  <option disabled={!apifyEnabled} value="apify_google_maps">
                    {apifyEnabled
                      ? "Apify - fontes disponiveis"
                      : apifyAvailability.reason === "budget_exceeded"
                        ? "Apify (orcamento atingido)"
                        : "Apify (requer token ou permissao)"}
                  </option>
                </select>
                <p className="text-xs leading-5 text-slate-500">Modo desenvolvedor. {sourceHints[form.source]}</p>
                {apifyAvailability.monthlyBudgetUsd !== undefined ? (
                  <p className="text-xs leading-5 text-slate-500">
                    Apify: US$ {(apifyAvailability.usedBudgetUsd ?? 0).toFixed(2)} de US$ {apifyAvailability.monthlyBudgetUsd.toFixed(2)} usados neste mes.
                  </p>
                ) : null}
                {!googlePlacesEnabled ? (
                  <p className="sr-only">Google Places esta desativado nesta instalacao ate a chave ser configurada.</p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-2 xl:col-span-3">
                <Label>Fonte da busca</Label>
                <div className="flex min-h-11 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  Venda de Sites
                </div>
                <p className="text-xs leading-5 text-slate-500">A busca sera feita automaticamente pela melhor fonte disponivel.</p>
              </div>
            )}

            {canSelectSource && form.source === "apify_google_maps" ? (
              <div className="grid gap-2 rounded-md border border-red-100 bg-red-50/40 p-3 md:col-span-2 xl:col-span-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor="apify-source">Fonte Apify disponivel</Label>
                  <Button
                    disabled={isSyncingApifySources || isSearching}
                    onClick={() => void handleSyncApifySources()}
                    type="button"
                    variant="outline"
                  >
                    {isSyncingApifySources ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Atualizar fontes
                  </Button>
                </div>
                <select
                  className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  disabled={!apifyEnabled || isSearching}
                  id="apify-source"
                  onChange={(event) => setSelectedApifySourceId(event.target.value)}
                  value={selectedApifySourceId}
                >
                  {apifySources.length === 0 ? (
                    <option value="">Nenhuma fonte Apify encontrada</option>
                  ) : null}
                  {apifySources.map((source) => (
                    <option disabled={!source.enabled} key={source.id} value={source.id}>
                      {source.name} - {source.kind === "task" ? "Task" : "Actor"} - {source.category.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-slate-600">
                  {selectedApifySource
                    ? `${selectedApifySource.supportedUse ?? "Executar fonte Apify"} ${selectedApifySource.estimatedCostLabel ? `Custo estimado: ${selectedApifySource.estimatedCostLabel}.` : ""}`
                    : apifyAvailability.reason === "missing_token"
                      ? "APIFY_TOKEN nao foi detectado no servidor."
                      : "Sincronize a conta para listar tasks e actors disponiveis."}
                </p>
              </div>
            ) : null}

            <div className="grid gap-2 xl:col-span-3">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Sao Paulo"
                required
                value={form.city}
              />
            </div>

            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                onChange={(event) => updateField("state", event.target.value)}
                placeholder="SP"
                required
                value={form.state}
              />
            </div>

            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="country">Pais</Label>
              <Input
                disabled={form.source === "cnpj_brasil"}
                id="country"
                onChange={(event) => updateField("country", event.target.value)}
                placeholder="Brasil"
                required
                value={form.country}
              />
            </div>

            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="category">Categoria</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                id="category"
                onChange={(event) => updateField("category", event.target.value as LeadCategoryId)}
                value={form.category}
              >
                {leadCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="radiusKm">Raio em km</Label>
              <Input
                disabled={form.source === "cnpj_brasil"}
                id="radiusKm"
                max={50}
                min={1}
                onChange={(event) => updateField("radiusKm", event.target.value)}
                required
                type="number"
                value={form.radiusKm}
              />
            </div>

            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="limit">Limite de resultados</Label>
              <Input
                id="limit"
                max={form.source === "google_places" ? 60 : 100}
                min={1}
                onChange={(event) => updateField("limit", event.target.value)}
                required
                type="number"
                value={form.limit}
              />
            </div>

            {form.source === "site_sales" ? (
              <div className="grid gap-2 self-end md:grid-cols-2 xl:col-span-4">
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  <input
                    checked={form.onlyWithPhone}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    onChange={(event) => updateField("onlyWithPhone", event.target.checked)}
                    type="checkbox"
                  />
                  Com telefone
                </label>
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  <input
                    checked={form.onlyWithoutWebsite}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    onChange={(event) => updateField("onlyWithoutWebsite", event.target.checked)}
                    type="checkbox"
                  />
                  Sem site conhecido
                </label>
              </div>
            ) : null}

            {form.source === "google_places" ? (
              <div className="grid gap-2 self-end md:grid-cols-2 xl:col-span-4">
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  <input
                    checked={form.onlyWithPhone}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    onChange={(event) => updateField("onlyWithPhone", event.target.checked)}
                    type="checkbox"
                  />
                  Com telefone
                </label>
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  <input
                    checked={form.onlyWithWebsite}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    onChange={(event) => updateField("onlyWithWebsite", event.target.checked)}
                    type="checkbox"
                  />
                  Com site
                </label>
              </div>
            ) : null}

            {form.source === "cnpj_brasil" ? (
              <label className="flex h-11 items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 xl:col-span-4">
                <input
                  checked={form.onlyWithPhone}
                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  onChange={(event) => updateField("onlyWithPhone", event.target.checked)}
                  type="checkbox"
                />
                Somente com telefone
              </label>
            ) : null}

            <div className="flex items-end xl:col-span-2 xl:justify-end">
              <Button disabled={isSearching} type="submit">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {form.source === "google_places"
                  ? "Buscar no Google Places"
                  : form.source === "site_sales"
                    ? "Buscar leads sem site"
                  : form.source === "cnpj_brasil"
                    ? "Buscar na base CNPJ"
                    : "Buscar leads"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle>Qualificação</CardTitle>
            <p className="text-sm leading-6 text-slate-500">
              Verifique contatos públicos disponíveis, como WhatsApp possível, Instagram, site e email.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-2 sm:min-w-72">
              <Label htmlFor="qualification-filter">Filtro de qualificacao</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                id="qualification-filter"
                onChange={(event) => setQualificationFilter(event.target.value as QualificationFilter)}
                value={qualificationFilter}
              >
                {(Object.keys(qualificationFilterLabels) as QualificationFilter[]).map((filter) => (
                  <option key={filter} value={filter}>
                    {qualificationFilterLabels[filter]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {qualificationProgress ? (
                <span className="text-sm text-slate-500">{qualificationProgress}</span>
              ) : null}
              <Button
                disabled={isQualifyingInstagram}
                onClick={handleQualifyContacts}
                type="button"
                variant="outline"
              >
                {isQualifyingInstagram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Instagram className="h-4 w-4" />
                )}
                Qualificar contatos
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {results.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <strong className="font-semibold text-slate-950">Resultados</strong> · {visibleResults.length} de {results.length} visíveis
          </span>
          <span className="text-xs text-slate-500">
            {selectedUnsavedResults.length > 0
              ? `${selectedUnsavedResults.length} selecionados para salvar`
              : "Selecione apenas os leads que deseja salvar."}
          </span>
        </div>
      ) : null}

      {isSearching ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-600" />
          Consultando {sourceLabels[form.source]}...
        </div>
      ) : visibleResults.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleResults.map((lead) => {
            const qualification = getLeadQualification(lead);
            const whatsapp = whatsappBadge(qualification);
            const instagram = instagramBadge(qualification);
            const whatsappHref = getWhatsAppHref(lead);

            return (
            <Card className="border-slate-200 bg-white shadow-sm" key={getLeadIdentifier(lead)}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <input
                      aria-label={`Selecionar ${lead.name}`}
                      checked={selectedResultIds.has(getLeadIdentifier(lead))}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      disabled={lead.saved}
                      onChange={(event) => toggleResultSelection(lead, event.target.checked)}
                      type="checkbox"
                    />
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-950">{lead.name}</h2>
                      {lead.saved ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Salvo
                        </span>
                      ) : null}
                      {lead.source === "cnpj_brasil" ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                          CNPJ
                        </span>
                      ) : null}
                      {lead.source === "google_places" ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          Google
                        </span>
                      ) : null}
                      {lead.source === "openstreetmap" ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          OSM
                        </span>
                      ) : null}
                      {lead.source === "apify_instagram" || lead.source === "apify_google_search" || lead.source === "apify_generic" ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                          Apify
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${whatsapp.className}`}>
                        {whatsapp.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${instagram.className}`}>
                        {instagram.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{lead.category}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {qualification.qualification_tags.map((tag) => (
                        <span
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                          key={tag}
                        >
                          {tag.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                    </div>
                  </div>
                  <Button
                    disabled={lead.saved || savingIds.has(getLeadIdentifier(lead))}
                    onClick={() => handleSaveLead(lead)}
                    size="sm"
                    type="button"
                  >
                    {lead.saved ? (
                      <Check className="h-4 w-4" />
                    ) : savingIds.has(getLeadIdentifier(lead)) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {lead.saved ? "Salvo" : "Salvar lead"}
                  </Button>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  {lead.address ? <p>{lead.address}</p> : <p className="text-slate-400">Endereco nao disponivel</p>}
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin className="h-4 w-4 text-red-600" />
                    <span>
                      {lead.city}, {lead.state}, {lead.country}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-4 w-4 text-red-600" />
                    <span>Telefone: {getContactPhone(lead) ?? "nao disponivel"}</span>
                  </div>
                  {lead.phone2 ? <p>Telefone 2: {lead.phone2}</p> : null}
                  {lead.email ? (
                    <a
                      className="inline-flex w-fit items-center gap-1 font-medium text-red-700 hover:text-red-800"
                      href={`mailto:${lead.email}`}
                    >
                      <Mail className="h-4 w-4" />
                      {lead.email}
                    </a>
                  ) : (
                    <p className="text-slate-400">Email nao disponivel</p>
                  )}
                  {lead.cnpj ? <p>CNPJ: {lead.cnpj}</p> : null}
                  {lead.cnae ? (
                    <div className="flex items-start gap-2 text-slate-500">
                      <Building2 className="mt-0.5 h-4 w-4 text-red-600" />
                      <span>CNAE: {lead.cnaeDescription ?? lead.cnae}</span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {whatsappHref ? (
                      <a
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        href={whatsappHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Abrir WhatsApp
                      </a>
                    ) : null}
                    {qualification.instagram_url ? (
                      <a
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-pink-200 px-3 text-xs font-semibold text-pink-700 transition hover:bg-pink-50"
                        href={qualification.instagram_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        {qualification.instagram_handle ? `@${qualification.instagram_handle}` : "Instagram"}
                      </a>
                    ) : (
                      <span className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-500">
                        Sem Instagram
                      </span>
                    )}
                    {lead.website ? (
                      <a
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Site
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-500">
                        Sem site
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {getCoordinateLabel(lead) ? `${getCoordinateLabel(lead)} - ` : ""}
                    {sourceLabels[lead.source]}
                  </p>
                  {lead.source === "google_places" ? (
                    <p className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
                      Fonte: Google Maps Platform.
                      {lead.sourceUrl ? (
                        <a
                          className="inline-flex items-center gap-1 font-medium text-red-700 hover:text-red-800"
                          href={lead.sourceUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Abrir no Google Maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      ) : results.length > 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-950">Nenhum lead nesse filtro</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Ajuste o filtro de qualificacao para visualizar outros resultados encontrados.
          </p>
        </div>
      ) : hasSearched ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mb-4 rounded-lg bg-red-100 p-3 text-red-700">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-950">Nenhum lead encontrado</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Confirme se a base CNPJ foi importada, tente aumentar o raio do OpenStreetMap ou desmarque algum filtro.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-500">
          Preencha os filtros acima para iniciar uma busca.
        </div>
      )}
    </section>
  );
}
