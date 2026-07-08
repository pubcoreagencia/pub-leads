"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, PhoneCall, Plus, Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadSourceLabels, leadStatusLabels } from "@/config/pipeline";
import { toast } from "@/hooks/use-toast";
import type { Lead, LeadFilters, LeadSource, LeadStatus } from "@/schemas/lead";
import { leadSourceSchema, leadStatusSchema } from "@/schemas/lead";
import { fetchLeads } from "@/services/leads";

type FilterState = {
  name: string;
  city: string;
  category: string;
  status: LeadStatus | "all";
  source: LeadSource | "all";
  onlyWithPhone: boolean;
};

const initialFilters: FilterState = {
  name: "",
  city: "",
  category: "",
  status: "all",
  source: "all",
  onlyWithPhone: false,
};

function toLeadFilters(filters: FilterState): LeadFilters {
  return {
    name: filters.name.trim() || undefined,
    city: filters.city.trim() || undefined,
    category: filters.category.trim() || undefined,
    onlyWithPhone: filters.onlyWithPhone,
    status: filters.status,
    source: filters.source,
  };
}

function hasContactPhone(lead: Lead) {
  return Boolean(lead.phone || lead.phone_2 || lead.whatsapp);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

export function LeadsPageContent() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(initialFilters);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  const loadLeads = useCallback(async () => {
    setIsLoading(true);

    try {
      const items = await fetchLeads(toLeadFilters(appliedFilters));
      setLeads(items);
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
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
                  {leads.map((lead) => (
                    <tr className="transition hover:bg-purple-50/50" key={lead.id}>
                      <td className="px-5 py-4">
                        <button
                          className="text-left"
                          onClick={() => openLeadModal(lead)}
                          type="button"
                        >
                          <span className="block font-medium text-slate-950">{lead.name}</span>
                          <span className="block text-xs text-slate-500">
                            {lead.company || lead.email || lead.phone || "Sem contato"}
                          </span>
                          {hasContactPhone(lead) ? (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <PhoneCall className="h-3 w-3" />
                              com telefone
                            </span>
                          ) : null}
                        </button>
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
                  ))}
                </tbody>
              </table>
            </div>
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
