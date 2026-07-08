"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MapPin } from "lucide-react";

import { leadSourceLabels } from "@/config/pipeline";
import { cn } from "@/lib/utils";
import type { Lead } from "@/schemas/lead";

type PipelineCardProps = {
  lead: Lead;
};

export function PipelineCard({ lead }: PipelineCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: {
      leadId: lead.id,
      status: lead.status,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition",
        isDragging && "z-20 opacity-70 shadow-premium",
      )}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex items-start gap-3">
        <button
          className="mt-0.5 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          type="button"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-950">{lead.name}</h3>
          <p className="mt-1 truncate text-xs text-slate-500">
            {lead.company || lead.category || "Sem empresa"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500">
        {lead.city ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{lead.city}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
            {leadSourceLabels[lead.source]}
          </span>
          {lead.category ? <span className="truncate">{lead.category}</span> : null}
        </div>
      </div>
    </article>
  );
}
