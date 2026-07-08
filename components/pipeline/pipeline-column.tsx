"use client";

import { useDroppable } from "@dnd-kit/core";

import { PipelineCard } from "@/components/pipeline/pipeline-card";
import type { PipelineColumn as PipelineColumnType } from "@/config/pipeline";
import { cn } from "@/lib/utils";
import type { Lead } from "@/schemas/lead";

type PipelineColumnProps = {
  column: PipelineColumnType;
  leads: Lead[];
};

export function PipelineColumn({ column, leads }: PipelineColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    data: {
      status: column.id,
    },
  });

  return (
    <section
      className={cn(
        "flex min-h-[320px] flex-col rounded-lg border border-slate-200 bg-slate-50/80",
        isOver && "border-purple-300 bg-purple-50",
      )}
      ref={setNodeRef}
    >
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-950">{column.title}</h2>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500">
            {leads.length}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{column.description}</p>
      </div>

      <div className="grid flex-1 content-start gap-3 p-3">
        {leads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-center text-xs leading-5 text-slate-500">
            Sem leads nesta etapa.
          </div>
        ) : (
          leads.map((lead) => <PipelineCard key={lead.id} lead={lead} />)
        )}
      </div>
    </section>
  );
}
