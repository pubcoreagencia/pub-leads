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
        "flex h-[calc(100vh-330px)] min-h-[560px] flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50/80",
        isOver && "border-red-300 bg-red-50 ring-2 ring-red-100",
      )}
      ref={setNodeRef}
    >
      <div className="border-b border-slate-200 bg-white/95 p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-950">{column.title}</h2>
          <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
            {leads.length}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{column.description}</p>
      </div>

      <div className="grid flex-1 content-start gap-2 overflow-y-auto p-2.5">
        {leads.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white/70 p-4 text-center text-xs leading-5 text-slate-500">
            Arraste um lead para esta etapa quando houver avanço comercial.
          </div>
        ) : (
          leads.map((lead) => <PipelineCard key={lead.id} lead={lead} />)
        )}
      </div>
    </section>
  );
}
