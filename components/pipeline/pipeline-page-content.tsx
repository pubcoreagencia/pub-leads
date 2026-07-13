"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { closestCorners, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { Loader2, RefreshCw, Target, TrendingUp, Users } from "lucide-react";

import { MetricCard, PageHeader } from "@/components/ops/page";
import { PipelineColumn } from "@/components/pipeline/pipeline-column";
import { Button } from "@/components/ui/button";
import { pipelineColumns } from "@/config/pipeline";
import { toast } from "@/hooks/use-toast";
import type { Lead, LeadStatus } from "@/schemas/lead";
import { fetchLeads, updateLeadStatus } from "@/services/leads";

export function PipelinePageContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<LeadStatus>("new");

  const loadLeads = useCallback(async () => {
    setIsLoading(true);

    try {
      const items = await fetchLeads();
      setLeads(items);
    } catch (error) {
      toast({
        title: "Erro ao carregar pipeline",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const leadsByStatus = useMemo(() => {
    return pipelineColumns.reduce<Record<LeadStatus, Lead[]>>(
      (groups, column) => {
        groups[column.id] = leads.filter((lead) => lead.status === column.id);
        return groups;
      },
      {
        new: [],
        qualified: [],
        contacted: [],
        responded: [],
        proposal: [],
        won: [],
        lost: [],
      },
    );
  }, [leads]);
  const activeLeads = leads.filter((lead) => !["won", "lost"].includes(lead.status)).length;
  const contactedLeads = leads.filter((lead) => ["contacted", "responded", "proposal"].includes(lead.status)).length;
  const wonLeads = leads.filter((lead) => lead.status === "won").length;
  const conversionRate = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;

  async function moveLeadToStatus(leadId: string, nextStatus: LeadStatus) {
    const lead = leads.find((item) => item.id === leadId);

    if (!lead || lead.status === nextStatus) {
      return;
    }

    const previousLeads = leads;
    setIsUpdating(true);
    setLeads((current) =>
      current.map((item) =>
        item.id === leadId ? { ...item, status: nextStatus, pipeline_stage: nextStatus } : item,
      ),
    );

    try {
      await updateLeadStatus(leadId, nextStatus);
      toast({ title: "Pipeline atualizado", variant: "success" });
    } catch (error) {
      setLeads(previousLeads);
      toast({
        title: "Erro ao atualizar status",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const leadId = String(event.active.id);
    const nextStatus = event.over?.data.current?.status as LeadStatus | undefined;

    if (!nextStatus) {
      return;
    }

    await moveLeadToStatus(leadId, nextStatus);
  }

  return (
    <section className="space-y-5">
      <PageHeader
        actions={(
          <Button disabled={isLoading || isUpdating} onClick={loadLeads} type="button" variant="outline">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        )}
        description="Arraste oportunidades entre etapas, priorize próximos contatos e acompanhe gargalos comerciais."
        eyebrow="CRM operacional"
        title="Pipeline"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard accent="red" icon={Users} label="Leads no pipeline" value={leads.length} />
        <MetricCard accent="blue" icon={TrendingUp} label="Ativos" value={activeLeads} />
        <MetricCard accent="emerald" helper={`${wonLeads} ganhos · ${conversionRate}%`} icon={Target} label="Em contato" value={contactedLeads} />
      </div>

      {isLoading ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-600" />
          Carregando pipeline...
        </div>
      ) : leads.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mb-4 rounded-lg bg-red-100 p-3 text-red-700">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-950">Pipeline vazio</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Crie leads manualmente na tela Leads para montar seu fluxo comercial.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pipelineColumns.map((column) => {
                const count = leadsByStatus[column.id].length;
                const active = mobileStatus === column.id;

                return (
                  <button
                    className={`min-w-40 rounded-md border p-3 text-left transition ${
                      active ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white hover:border-red-200 hover:bg-slate-50"
                    }`}
                    key={column.id}
                    onClick={() => setMobileStatus(column.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase">{column.title}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">{count}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-red-600"
                        style={{ width: leads.length > 0 ? `${Math.max(8, Math.round((count / leads.length) * 100))}%` : "0%" }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:hidden">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
              {pipelineColumns.map((column) => (
                <button
                  className={`min-w-fit rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    mobileStatus === column.id
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  key={column.id}
                  onClick={() => setMobileStatus(column.id)}
                  type="button"
                >
                  {column.title} ({leadsByStatus[column.id].length})
                </button>
              ))}
            </div>
            <div className="grid gap-3">
              {leadsByStatus[mobileStatus].length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm leading-6 text-slate-500">
                  Nenhum lead nesta etapa.
                </div>
              ) : (
                leadsByStatus[mobileStatus].map((lead) => (
                  <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={lead.id}>
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-sm font-semibold text-slate-950">{lead.name}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {[lead.city, lead.category].filter(Boolean).join(" · ") || "Sem contexto"}
                      </p>
                    </div>
                    <label className="mt-4 grid gap-2 text-xs font-medium text-slate-600">
                      Mover para
                      <select
                        className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        disabled={isUpdating}
                        onChange={(event) => void moveLeadToStatus(lead.id, event.target.value as LeadStatus)}
                        value={lead.status}
                      >
                        {pipelineColumns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="hidden md:block">
            <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto pb-3">
                <div className="grid min-w-[1760px] grid-cols-[repeat(7,minmax(240px,1fr))] gap-3">
                  {pipelineColumns.map((column) => (
                    <PipelineColumn column={column} key={column.id} leads={leadsByStatus[column.id]} />
                  ))}
                </div>
              </div>
            </DndContext>
          </div>
        </>
      )}
    </section>
  );
}
