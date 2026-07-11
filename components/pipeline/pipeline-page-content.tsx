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

  async function handleDragEnd(event: DragEndEvent) {
    const leadId = String(event.active.id);
    const nextStatus = event.over?.data.current?.status as LeadStatus | undefined;

    if (!nextStatus) {
      return;
    }

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

  return (
    <section className="space-y-6">
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
        <MetricCard accent="purple" icon={Users} label="Leads no pipeline" value={leads.length} />
        <MetricCard accent="blue" icon={TrendingUp} label="Ativos" value={activeLeads} />
        <MetricCard accent="emerald" helper={`${wonLeads} ganhos`} icon={Target} label="Em contato" value={contactedLeads} />
      </div>

      {isLoading ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-600" />
          Carregando pipeline...
        </div>
      ) : leads.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mb-4 rounded-lg bg-purple-100 p-3 text-purple-700">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-950">Pipeline vazio</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Crie leads manualmente na tela Leads para montar seu fluxo comercial.
          </p>
        </div>
      ) : (
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-3">
            <div className="grid min-w-[1260px] grid-cols-7 gap-4">
              {pipelineColumns.map((column) => (
                <PipelineColumn column={column} key={column.id} leads={leadsByStatus[column.id]} />
              ))}
            </div>
          </div>
        </DndContext>
      )}
    </section>
  );
}
