"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Check,
  ExternalLink,
  Instagram,
  Loader2,
  MapPin,
  Phone,
  Save,
  Search,
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
import type { ExternalLead, NormalizedLead } from "@/src/lib/lead-sources/types";

type LeadSearchSource = "site_sales" | "openstreetmap" | "cnpj_brasil" | "google_places";
type QualificationFilter = "all" | "possible_whatsapp" | "missing_whatsapp" | "with_instagram";

type SearchResultLead = (ExternalLead | NormalizedLead) & {
  qualification?: LeadQualification;
  saved?: boolean;
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
  googlePlacesEnabled: boolean;
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

const sourceLabels: Record<LeadSearchSource, string> = {
  cnpj_brasil: "CNPJ Brasil",
  google_places: "Google Places oficial",
  openstreetmap: "OpenStreetMap/Overpass",
  site_sales: "Venda de Sites",
};

const sourceHints: Record<LeadSearchSource, string> = {
  cnpj_brasil: "Fonte gratuita principal; exige importar os arquivos oficiais da Receita Federal.",
  google_places: "Requer chave da API oficial do Google Maps Platform.",
  openstreetmap: "Complemento gratuito com cobertura variavel por cidade.",
  site_sales: "Busca CNPJ + OpenStreetMap, priorizando telefone e ausencia de site.",
};

const qualificationFilterLabels: Record<QualificationFilter, string> = {
  all: "Todos",
  missing_whatsapp: "Sem WhatsApp",
  possible_whatsapp: "Com possivel WhatsApp",
  with_instagram: "Com Instagram",
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
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Nao foi possivel concluir a operacao.");
  }

  return payload;
}

export function ScraperPageContent({ googlePlacesEnabled }: ScraperPageContentProps) {
  const [form, setForm] = useState<SearchFormState>(initialForm);
  const [results, setResults] = useState<SearchResultLead[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isQualifyingInstagram, setIsQualifyingInstagram] = useState(false);
  const [qualificationFilter, setQualificationFilter] = useState<QualificationFilter>("all");
  const [qualificationProgress, setQualificationProgress] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);

  const unsavedResults = useMemo(() => results.filter((lead) => !lead.saved), [results]);
  const visibleResults = useMemo(
    () =>
      results.filter((lead) => {
        const qualification = getLeadQualification(lead);

        if (qualificationFilter === "possible_whatsapp") {
          return qualification.whatsapp_status === "possible" || qualification.whatsapp_status === "confirmed";
        }

        if (qualificationFilter === "missing_whatsapp") {
          return qualification.whatsapp_status === "missing" || qualification.whatsapp_status === "invalid";
        }

        if (qualificationFilter === "with_instagram") {
          return qualification.instagram_status === "found";
        }

        return true;
      }),
    [qualificationFilter, results],
  );

  function updateField<K extends keyof SearchFormState>(field: K, value: SearchFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSourceChange(source: LeadSearchSource) {
    if (source === "google_places" && !googlePlacesEnabled) {
      toast({
        title: "Google Places indisponivel",
        description: "Essa fonte requer GOOGLE_PLACES_API_KEY ou GOOGLE_MAPS_API_KEY configurada.",
        variant: "error",
      });
      return;
    }

    setForm((current) => ({
      ...current,
      onlyWithPhone: source === "site_sales" ? true : current.onlyWithPhone,
      onlyWithoutWebsite: source === "site_sales" ? true : current.onlyWithoutWebsite,
      source,
    }));
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    try {
      const category = leadCategories.find((item) => item.id === form.category);
      if (form.source === "google_places" && !googlePlacesEnabled) {
        throw new Error("Google Places requer chave de API configurada.");
      }

      const limit = Math.min(Number(form.limit), form.source === "google_places" ? 60 : 100);
      const endpointBySource: Record<LeadSearchSource, string> = {
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

  async function saveLeads(leads: SearchResultLead[]) {
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

  async function handleQualifyInstagram() {
    const leadsToQualify = results.filter((lead) => {
      const qualification = getLeadQualification(lead);

      return qualification.instagram_status !== "found" && Boolean(lead.website);
    });

    if (leadsToQualify.length === 0) {
      toast({
        title: "Nada para qualificar",
        description: "Nenhum lead com site disponivel para buscar Instagram.",
        variant: "error",
      });
      return;
    }

    setIsQualifyingInstagram(true);
    setQualificationProgress(`Qualificando 0/${leadsToQualify.length}`);

    try {
      const updates = new Map<string, { qualification: LeadQualification; rawData: Record<string, unknown> }>();

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
              id: string;
              qualification: LeadQualification;
              rawData: Record<string, unknown>;
            }>;
          }>(response),
        );

        payload.results.forEach((result) => {
          updates.set(result.id, {
            qualification: result.qualification,
            rawData: result.rawData,
          });
        });
        setQualificationProgress(
          `Qualificando ${Math.min(index + chunk.length, leadsToQualify.length)}/${leadsToQualify.length}`,
        );
      }

      setResults((current) =>
        current.map((lead) => {
          const update = updates.get(getLeadIdentifier(lead));

          return update ? { ...lead, ...update } : lead;
        }),
      );
      toast({
        title: "Qualificacao concluida",
        description: "Busca publica por Instagram finalizada para os leads com site.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao qualificar Instagram",
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

  async function handleSaveAll() {
    if (unsavedResults.length === 0) {
      return;
    }

    setIsSavingAll(true);

    try {
      const data = await saveLeads(unsavedResults);
      toast({
        title: "Leads salvos",
        description: `${data.savedExternalIds.length} novos leads salvos. ${data.skippedExternalIds.length} duplicados ignorados.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar todos",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSavingAll(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Prospeccao de leads</h1>
            <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
              Venda de Sites
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Encontre empresas com telefone e sem site conhecido usando CNPJ Brasil e OpenStreetMap.
          </p>
        </div>
        <Button disabled={unsavedResults.length === 0 || isSavingAll} onClick={handleSaveAll} type="button">
          {isSavingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar todos
        </Button>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Buscar leads</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={handleSearch}>
            <div className="grid gap-2">
              <Label htmlFor="source">Fonte</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
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
              </select>
              <p className="text-xs leading-5 text-slate-500">{sourceHints[form.source]}</p>
              {!googlePlacesEnabled ? (
                <p className="text-xs leading-5 text-amber-700">
                  Google Places está desativado nesta instalação até a chave ser configurada.
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Sao Paulo"
                required
                value={form.city}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                onChange={(event) => updateField("state", event.target.value)}
                placeholder="SP"
                required
                value={form.state}
              />
            </div>

            <div className="grid gap-2">
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

            <div className="grid gap-2">
              <Label htmlFor="category">Categoria</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
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

            <div className="grid gap-2">
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

            <div className="grid gap-2">
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
              <div className="grid gap-2 self-end md:grid-cols-2 xl:col-span-2">
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  <input
                    checked={form.onlyWithPhone}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    onChange={(event) => updateField("onlyWithPhone", event.target.checked)}
                    type="checkbox"
                  />
                  Com telefone
                </label>
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  <input
                    checked={form.onlyWithoutWebsite}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    onChange={(event) => updateField("onlyWithoutWebsite", event.target.checked)}
                    type="checkbox"
                  />
                  Sem site conhecido
                </label>
              </div>
            ) : null}

            {form.source === "google_places" ? (
              <div className="grid gap-2 self-end md:grid-cols-2 xl:col-span-2">
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  <input
                    checked={form.onlyWithPhone}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    onChange={(event) => updateField("onlyWithPhone", event.target.checked)}
                    type="checkbox"
                  />
                  Com telefone
                </label>
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  <input
                    checked={form.onlyWithWebsite}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    onChange={(event) => updateField("onlyWithWebsite", event.target.checked)}
                    type="checkbox"
                  />
                  Com site
                </label>
              </div>
            ) : null}

            {form.source === "cnpj_brasil" ? (
              <label className="flex h-11 items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                <input
                  checked={form.onlyWithPhone}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  onChange={(event) => updateField("onlyWithPhone", event.target.checked)}
                  type="checkbox"
                />
                Somente com telefone
              </label>
            ) : null}

            <div className="md:col-span-2 xl:col-span-6">
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
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-2 sm:min-w-72">
              <Label htmlFor="qualification-filter">Filtro de qualificacao</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
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
                onClick={handleQualifyInstagram}
                type="button"
                variant="outline"
              >
                {isQualifyingInstagram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Instagram className="h-4 w-4" />
                )}
                Buscar Instagram dos leads
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isSearching ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-600" />
          Consultando {sourceLabels[form.source]}...
        </div>
      ) : visibleResults.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleResults.map((lead) => {
            const qualification = getLeadQualification(lead);
            const whatsapp = whatsappBadge(qualification);
            const instagram = instagramBadge(qualification);

            return (
            <Card className="border-slate-200 bg-white shadow-sm" key={getLeadIdentifier(lead)}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-950">{lead.name}</h2>
                      {lead.saved ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Salvo
                        </span>
                      ) : null}
                      {lead.source === "cnpj_brasil" ? (
                        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
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
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${whatsapp.className}`}>
                        {whatsapp.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${instagram.className}`}>
                        {instagram.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{lead.category}</p>
                    {qualification.instagram_status === "found" ? (
                      <p className="mt-1 text-xs font-medium text-pink-700">
                        Lead com Instagram
                        {qualification.instagram_handle ? `: @${qualification.instagram_handle}` : ""}
                      </p>
                    ) : null}
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
                    <MapPin className="h-4 w-4 text-purple-600" />
                    <span>
                      {lead.city}, {lead.state}, {lead.country}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-4 w-4 text-purple-600" />
                    <span>Telefone: {lead.phone ?? "nao disponivel"}</span>
                  </div>
                  {lead.phone2 ? <p>Telefone 2: {lead.phone2}</p> : null}
                  {lead.email ? <p>Email: {lead.email}</p> : null}
                  {lead.cnpj ? <p>CNPJ: {lead.cnpj}</p> : null}
                  {lead.cnae ? (
                    <div className="flex items-start gap-2 text-slate-500">
                      <Building2 className="mt-0.5 h-4 w-4 text-purple-600" />
                      <span>CNAE: {lead.cnaeDescription ?? lead.cnae}</span>
                    </div>
                  ) : null}
                  <p>Site: {lead.website ?? "nao disponivel"}</p>
                  <p className="text-xs text-slate-400">
                    {getCoordinateLabel(lead) ? `${getCoordinateLabel(lead)} - ` : ""}
                    {sourceLabels[lead.source]}
                  </p>
                  {lead.source === "google_places" ? (
                    <p className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
                      Fonte: Google Maps Platform.
                      {lead.sourceUrl ? (
                        <a
                          className="inline-flex items-center gap-1 font-medium text-purple-700 hover:text-purple-800"
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
          <div className="mb-4 rounded-lg bg-purple-100 p-3 text-purple-700">
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
