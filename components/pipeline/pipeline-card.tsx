"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Globe2, GripVertical, Instagram, MapPin, MessageCircle } from "lucide-react";

import { leadSourceLabels } from "@/config/pipeline";
import { getLeadQualification } from "@/src/lib/lead-qualification/qualifier";
import { cn } from "@/lib/utils";
import type { Lead } from "@/schemas/lead";

type PipelineCardProps = {
  lead: Lead;
};

export function PipelineCard({ lead }: PipelineCardProps) {
  const qualification = getLeadQualification(lead);
  const phone = lead.whatsapp || lead.phone || lead.phone_2;
  const phoneDigits = phone?.replace(/\D/g, "") ?? "";
  const whatsappUrl = phoneDigits ? `https://wa.me/${phoneDigits}` : null;
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
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium",
              qualification.whatsapp_status === "confirmed"
                ? "bg-emerald-50 text-emerald-700"
                : qualification.whatsapp_status === "possible"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-600",
            )}
          >
            <MessageCircle className="h-3 w-3" />
            {qualification.whatsapp_status === "confirmed"
              ? "WhatsApp"
              : qualification.whatsapp_status === "possible"
                ? "Possivel WhatsApp"
                : "Sem WhatsApp"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium",
              qualification.instagram_status === "found"
                ? "bg-pink-50 text-pink-700"
                : "bg-slate-100 text-slate-600",
            )}
          >
            <Instagram className="h-3 w-3" />
            {qualification.instagram_status === "found" ? "Instagram" : "Sem Instagram"}
          </span>
          {lead.website ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
              <Globe2 className="h-3 w-3" />
              Site
            </span>
          ) : null}
        </div>
        {whatsappUrl || qualification.instagram_url ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {whatsappUrl ? (
              <a
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                href={whatsappUrl}
                rel="noreferrer"
                target="publeads_whatsapp_workspace"
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </a>
            ) : null}
            {qualification.instagram_url ? (
              <a
                className="inline-flex items-center gap-1 text-xs font-medium text-pink-700 hover:text-pink-800"
                href={qualification.instagram_url}
                rel="noreferrer"
                target="publeads_instagram_workspace"
              >
                <Instagram className="h-3 w-3" /> Instagram
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
