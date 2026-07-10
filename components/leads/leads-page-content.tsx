"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Globe2,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  PhoneCall,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";

import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadSourceLabels, leadStatusLabels } from "@/config/pipeline";
import { toast } from "@/hooks/use-toast";
import type { Lead, LeadFilters, LeadSource, LeadStatus } from "@/schemas/lead";
import { leadSourceSchema, leadStatusSchema } from "@/schemas/lead";
import { deleteLeads as deleteManyLeads, fetchLeads } from "@/services/leads";
import {
  getLeadQualification,
  type LeadQualification,
} from "@/src/lib/lead-qualification/qualifier";
import { createWaLink } from "@/src/lib/whatsapp/wa-link";

type FilterState = {
  name: string;
  city: string;
  category: string;
  status: LeadStatus | "all";
  source: LeadSource | "all";
  onlyWithPhone: boolean;
  qualification: NonNullable<LeadFilters["qualification"]>;
  site: NonNullable<LeadFilters["site"]>;
};

const initialFilters: FilterState = {
  name: "",
  city: "",
  category: "",
  status: "all",
  source: "all",
  onlyWithPhone: false,
  qualification: "all",
  site: "all",
};

function toLeadFilters(filters: FilterState): LeadFilters {
  return {
    name: filters.name.trim() || undefined,
    city: filters.city.trim() || undefined,
    category: filters.category.trim() || undefined,
    onlyWithPhone: filters.onlyWithPhone,
    qualification: filters.qualification,
    site: filters.site,
    status: filters.status,
    source: filters.source,
  };
}

function hasContactPhone(lead: Lead) {
  return Boolean(lead.phone || lead.phone_2 || lead.whatsapp);
}

function getContactPhone(lead: Lead) {
  return lead.whatsapp ?? lead.phone ?? lead.phone_2;
}

function getWebsiteHref(website: string | null) {
  if (!website) {
    return null;
  }

  return website.startsWith("http") ? website : `https://${website}`;
}

function getWhatsAppHref(lead: Lead) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function whatsappBadge(qualification: LeadQualification) {
  if (qualification.whatsapp_status === "confirmed") {
    return { className: "bg-emerald-50 text-emerald-700", label: "WhatsApp confirmado" };
  }

  if (qualification.whatsapp_status === "possible") {
    return { className: "bg-blue-50 text-blue-700", label: "Possivel WhatsApp" };
  }

  if (qualification.whatsapp_status === "landline") {
    return { className: "bg-amber-50 text-amber-800", label: "Telefone fixo" };
  }

  if (qualification.whatsapp_status === "invalid") {
    return { className: "bg-red-50 text-red-700", label: "Telefone invalido" };
  }

  return { className: "bg-slate-100 text-slate-700", label: "Sem WhatsApp" };
}

function instagramBadge(qualification: LeadQualification) {
  if (qualification.instagram_status === "found") {
    return { className: "bg-pink-50 text-pink-700", label: "Instagram" };
  }

  if (qualification.instagram_status === "missing") {
    return { className: "bg-slate-100 text-slate-700", label: "Sem Instagram" };
  }

  return { className: "bg-amber-50 text-amber-700", label: "Instagram nao verificado" };
}

export function LeadsPageContent() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(initialFilters);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const loadLeads = useCallback(async () => {
    setIsLoading(true);

    try {
      const items = await fetchLeads(toLeadFilters(appliedFilters));
      setLeads(items);
      setSelectedLeadIds((current) => {
        const visibleIds = new Set(items.map((lead) => lead.id));
        return new Set(Array.from(current).filter((id) => visibleIds.has(id)));
      });
    } catch (error) {
      toast({
        title: "Erro ao carregar leads",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  function openCreateModal() {
    setSelectedLead(null);
    setIsModalOpen(true);
  }

  function openLeadModal(lead: Lead) {
    setSelectedLead(lead);
    setIsModalOpen(true);
  }

  function handleApplyFilters() {
    setAppliedFilters(filters);
  }

  function handleClearFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }

  function toggleLeadSelection(leadId: string, checked: boolean) {
    setSelectedLeadIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(leadId);
      } else {
        next.delete(leadId);
      }

      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedLeadIds((current) => {
      const next = new Set(current);

      leads.forEach((lead) => {
        if (checked) {
          next.add(lead.id);
        } else {
          next.delete(lead.id);
        }
      });

      return next;
    });
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selectedLeadIds);

    if (ids.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir ${ids.length} leads? Essa acao nao pode ser desfeita.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const deletedCount = await deleteManyLeads(ids);
      const deletedIds = new Set(ids);

      setLeads((current) => current.filter((lead) => !deletedIds.has(lead.id)));
      setSelectedLeadIds(new Set());

      if (selectedLead && deletedIds.has(selectedLead.id)) {
        setSelectedLead(null);
        setIsModalOpen(false);
      }

      toast({
        title: "Leads excluidos",
        description: `${deletedCount} leads foram removidos.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir leads",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleEnrichLead(lead: Lead) {
    setEnrichingIds((current) => new Set(current).add(lead.id));

    try {
      const response = await fetch("/api/leads/enrich/cnpj", {
        body: JSON.stringify({ leadId: lead.id }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        matched?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel enriquecer o lead.");
      }

      if (!payload.matched) {
        toast({
          title: "CNPJ nao encontrado",
          description: payload.message ?? "Tente ajustar nome, cidade ou estado do lead.",
          variant: "error",
        });
        return;
      }

      toast({ title: "Lead enriquecido com CNPJ", variant: "success" });
      await loadLeads();
    } catch (error) {
      toast({
        title: "Erro ao enriquecer",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setEnrichingIds((current) => {
        const next = new Set(current);
        next.delete(lead.id);
        return next;
      });
    }
  }

  const selectedCount = selectedLeadIds.size;
  const allVisibleSelected = leads.length > 0 && leads.every((lead) => selectedLeadIds.has(lead.id));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Leads</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Gerencie contatos, dados comerciais e notas internas.
          </p>
        </div>
        <Button onClick={openCreateModal} type="button">
          <Plus className="h-4 w-4" />
          Novo lead
        </Button>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <SlidersHorizontal className="h-4 w-4 text-purple-600" />
            Filtros
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
            <div className="grid gap-2">
              <Label htmlFor="filter-name">Nome</Label>
              <Input
                id="filter-name"
                onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
                placeholder="Buscar por nome"
                value={filters.name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-city">Cidade</Label>
              <Input
                id="filter-city"
                onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}
                placeholder="Cidade"
                value={filters.city}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-category">Categoria</Label>
              <Input
                id="filter-category"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, category: event.target.value }))
                }
                placeholder="Categoria"
                value={filters.category}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-status">Status</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                id="filter-status"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as LeadStatus | "all",
                  }))
                }
                value={filters.status}
              >
                <option value="all">Todos</option>
                {leadStatusSchema.options.map((status) => (
                  <option key={status} value={status}>
                    {leadStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-source">Origem</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                id="filter-source"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    source: event.target.value as LeadSource | "all",
                  }))
                }
                value={filters.source}
              >
                <option value="all">Todas</option>
                {leadSourceSchema.options.map((source) => (
                  <option key={source} value={source}>
                    {leadSourceLabels[source]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-qualification">Qualificacao</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                id="filter-qualification"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    qualification: event.target.value as FilterState["qualification"],
                  }))
                }
                value={filters.qualification}
              >
                <option value="all">Todas</option>
                <option value="with_whatsapp">Com WhatsApp</option>
                <option value="without_whatsapp">Sem WhatsApp</option>
                <option value="with_instagram">Com Instagram</option>
                <option value="without_instagram">Sem Instagram</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-site">Site</Label>
              <select
                className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                id="filter-site"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    site: event.target.value as FilterState["site"],
                  }))
                }
                value={filters.site}
              >
                <option value="all">Todos</option>
                <option value="with_site">Com site</option>
                <option value="without_site">Sem site</option>
              </select>
            </div>
            <label className="flex h-11 items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
              <input
                checked={filters.onlyWithPhone}
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, onlyWithPhone: event.target.checked }))
                }
                type="checkbox"
              />
              Somente com telefone
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleApplyFilters} type="button">
              <Search className="h-4 w-4" />
              Aplicar filtros
            </Button>
            <Button onClick={handleClearFilters} type="button" variant="outline">
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          {selectedCount > 0 ? (
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-red-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-red-900">
                {selectedCount} {selectedCount === 1 ? "lead selecionado" : "leads selecionados"}
              </span>
              <Button
                className="border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800"
                disabled={isDeleting}
                onClick={handleDeleteSelected}
                type="button"
                variant="outline"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {selectedCount === 1 ? "Excluir selecionado" : `Excluir ${selectedCount} leads`}
              </Button>
            </div>
          ) : null}
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              Carregando leads...
            </div>
          ) : leads.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 rounded-lg bg-purple-100 p-3 text-purple-700">
                <Search className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950">Nenhum lead encontrado</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Ajuste os filtros ou crie um lead manual para iniciar o pipeline.
              </p>
            </div>
          ) : (
            <>
            <div className="grid gap-3 p-4 md:hidden">
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <input
                  aria-label="Selecionar todos os leads visiveis"
                  checked={allVisibleSelected}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  onChange={(event) => toggleAllVisible(event.target.checked)}
                  type="checkbox"
                />
                Selecionar todos visiveis
              </label>
              {leads.map((lead) => {
                const qualification = getLeadQualification(lead);
                const whatsapp = whatsappBadge(qualification);
                const instagram = instagramBadge(qualification);
                const whatsappHref = getWhatsAppHref(lead);
                const websiteHref = getWebsiteHref(lead.website);

                return (
                  <article className="rounded-lg border border-slate-200 bg-white p-4" key={lead.id}>
                    <div className="flex items-start gap-3">
                      <input
                        aria-label={`Selecionar ${lead.name}`}
                        checked={selectedLeadIds.has(lead.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        onChange={(event) => toggleLeadSelection(lead.id, event.target.checked)}
                        type="checkbox"
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          className="text-left text-base font-semibold text-slate-950 hover:text-purple-700"
                          onClick={() => openLeadModal(lead)}
                          type="button"
                        >
                          {lead.name}
                        </button>
                        <p className="mt-1 text-sm text-slate-500">
                          {[lead.category, lead.city, lead.state].filter(Boolean).join(" · ") || "Sem detalhes"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${whatsapp.className}`}>
                        {whatsapp.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${instagram.className}`}>
                        {instagram.label}
                      </span>
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {leadStatusLabels[lead.status]}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {leadSourceLabels[lead.source]}
                      </span>
                    </div>

                    {qualification.instagram_status === "found" && qualification.whatsapp_status === "missing" ? (
                      <p className="mt-2 text-xs font-medium text-pink-700">Lead com Instagram</p>
                    ) : null}

                    <div className="mt-3 grid gap-1.5 text-sm text-slate-600">
                      {getContactPhone(lead) ? <p>Telefone: {getContactPhone(lead)}</p> : null}
                      {lead.email ? <p>Email: {lead.email}</p> : null}
                      {lead.website ? <p>Site: {lead.website}</p> : <p className="text-slate-400">Sem site</p>}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {whatsappHref ? (
                        <a
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                          href={whatsappHref}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
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
                          Instagram
                        </a>
                      ) : null}
                      {websiteHref ? (
                        <a
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          href={websiteHref}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <Globe2 className="h-3.5 w-3.5" />
                          Site
                        </a>
                      ) : null}
                      <Button onClick={() => openLeadModal(lead)} size="sm" type="button" variant="outline">
                        Detalhes
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-12 px-5 py-3">
                      <input
                        aria-label="Selecionar todos os leads visiveis"
                        checked={allVisibleSelected}
                        className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        onChange={(event) => toggleAllVisible(event.target.checked)}
                        type="checkbox"
                      />
                    </th>
                    <th className="px-5 py-3 font-semibold">Lead</th>
                    <th className="px-5 py-3 font-semibold">Cidade</th>
                    <th className="px-5 py-3 font-semibold">Categoria</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Origem</th>
                    <th className="px-5 py-3 font-semibold">Criado em</th>
                    <th className="px-5 py-3 font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => {
                    const qualification = getLeadQualification(lead);
                    const whatsapp = whatsappBadge(qualification);
                    const instagram = instagramBadge(qualification);
                    const whatsappHref = getWhatsAppHref(lead);
                    const websiteHref = getWebsiteHref(lead.website);

                    return (
                    <tr className="transition hover:bg-purple-50/50" key={lead.id}>
                      <td className="px-5 py-4 align-top">
                        <input
                          aria-label={`Selecionar ${lead.name}`}
                          checked={selectedLeadIds.has(lead.id)}
                          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          onChange={(event) => toggleLeadSelection(lead.id, event.target.checked)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-left">
                          <button
                            className="block text-left font-medium text-slate-950 hover:text-purple-700"
                            onClick={() => openLeadModal(lead)}
                            type="button"
                          >
                            {lead.name}
                          </button>
                          <span className="block text-xs text-slate-500">
                            {lead.company || lead.email || lead.phone || "Sem contato"}
                          </span>
                          {hasContactPhone(lead) ? (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <PhoneCall className="h-3 w-3" />
                              com telefone
                            </span>
                          ) : null}
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${whatsapp.className}`}>
                            {whatsapp.label}
                          </span>
                          <span className={`ml-1 mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${instagram.className}`}>
                            {instagram.label}
                          </span>
                          {qualification.instagram_status === "found" && qualification.whatsapp_status === "missing" ? (
                            <span className="mt-1 block text-xs font-medium text-pink-700">
                              Lead com Instagram
                            </span>
                          ) : null}
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {whatsappHref ? (
                              <a
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                                href={whatsappHref}
                                rel="noreferrer"
                                target="_blank"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MessageCircle className="h-3 w-3" />
                                WhatsApp
                              </a>
                            ) : null}
                            {qualification.instagram_url ? (
                              <a
                                className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700"
                                href={qualification.instagram_url}
                                rel="noreferrer"
                                target="_blank"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Instagram className="h-3 w-3" />
                                {qualification.instagram_handle ? `@${qualification.instagram_handle}` : "Instagram"}
                              </a>
                            ) : null}
                            {websiteHref ? (
                              <a
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                                href={websiteHref}
                                rel="noreferrer"
                                target="_blank"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Globe2 className="h-3 w-3" />
                                Site
                              </a>
                            ) : null}
                            {lead.email ? (
                              <a
                                className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700"
                                href={`mailto:${lead.email}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Mail className="h-3 w-3" />
                                Email
                              </a>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{lead.city || "-"}</td>
                      <td className="px-5 py-4 text-slate-600">{lead.category || "-"}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                          {leadStatusLabels[lead.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{leadSourceLabels[lead.source]}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(lead.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => openLeadModal(lead)} size="sm" type="button" variant="outline">
                            Detalhes
                          </Button>
                          {!hasContactPhone(lead) ? (
                            <Button
                              disabled={enrichingIds.has(lead.id)}
                              onClick={() => handleEnrichLead(lead)}
                              size="sm"
                              type="button"
                            >
                              {enrichingIds.has(lead.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                              Enriquecer com CNPJ
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <LeadDetailModal
        lead={selectedLead}
        onChanged={loadLeads}
        onClose={() => setIsModalOpen(false)}
        open={isModalOpen}
      />
    </section>
  );
}
