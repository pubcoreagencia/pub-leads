"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Globe2, GripVertical, Instagram, MapPin, MessageCircle } from "lucide-react";

import { leadSourceLabels } from "@/config/pipeline";
import { cn } from "@/lib/utils";
import type { Lead } from "@/schemas/lead";
import { getLeadQualification } from "@/src/lib/lead-qualification/qualifier";
import { isMobileWhatsappEnvironment } from "@/src/lib/whatsapp/wa-link";

type PipelineCardProps = {
  lead: Lead;
};

export function PipelineCard({ lead }: PipelineCardProps) {
  const [usesMobileWhatsappApp, setUsesMobileWhatsappApp] = useState(false);
  const qualification = getLeadQualification(lead);
  const whatsappUrl = useMemo(() => {
    if (qualification.whatsapp_status !== "confirmed" && qualification.whatsapp_status !== "possible") {
      return null;
    }

    return usesMobileWhatsappApp
      ? `whatsapp://send?phone=${qualification.normalized_whatsapp}`
      : `https://web.whatsapp.com/send?phone=${qualification.normalized_whatsapp}`;
  }, [qualification.normalized_whatsapp, qualification.whatsapp_status, usesMobileWhatsappApp]);
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

  useEffect(() => {
    setUsesMobileWhatsappApp(isMobileWhatsappEnvironment());
  }, []);

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md",
        isDragging && "z-20 scale-[0.98] opacity-60 shadow-lg ring-2 ring-red-200",
      )}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex items-start gap-2 p-3 pb-2">
        <button
          className="mt-0.5 rounded-md p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 group-hover:text-slate-500"
          type="button"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{lead.name}</h3>
          <p className="mt-1 truncate text-xs text-slate-500">
            {lead.company || lead.category || "Sem empresa"}
          </p>
        </div>
      </div>

      <div className="grid gap-2 px-3 pb-3 text-xs text-slate-500">
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{lead.city || "Cidade não informada"}</span>
        </div>

        <div className="flex min-w-0 flex-wrap gap-1.5">
          <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
            {leadSourceLabels[lead.source]}
          </span>
          {lead.category ? (
            <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              {lead.category}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 font-medium",
              qualification.whatsapp_status === "confirmed"
                ? "bg-emerald-50 text-emerald-700"
                : qualification.whatsapp_status === "possible"
                  ? "bg-blue-50 text-blue-700"
                  : qualification.whatsapp_status === "landline"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-slate-100 text-slate-600",
            )}
          >
            <MessageCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {qualification.whatsapp_status === "confirmed"
                ? "WhatsApp"
                : qualification.whatsapp_status === "possible"
                  ? "Possível WhatsApp"
                  : qualification.whatsapp_status === "landline"
                    ? "Telefone"
                    : "Sem WhatsApp"}
            </span>
          </span>
          {qualification.instagram_status === "found" ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 font-medium text-pink-700">
              <Instagram className="h-3 w-3 shrink-0" />
              <span className="truncate">Instagram</span>
            </span>
          ) : null}
          {lead.website ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              <Globe2 className="h-3 w-3 shrink-0" />
              <span className="truncate">Site</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 border-t border-slate-100 bg-slate-50/80 p-2">
        {whatsappUrl ? (
          <a
            className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-md text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
            href={whatsappUrl}
            rel="noreferrer"
            target="publeads_whatsapp_workspace"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">WhatsApp</span>
          </a>
        ) : (
          <span className="inline-flex h-8 items-center justify-center rounded-md text-xs font-medium text-slate-400">Sem WhatsApp</span>
        )}
        <Link
          className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-md text-xs font-medium text-red-700 transition hover:bg-red-50"
          href="/app/whatsapp"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Funil</span>
        </Link>
      </div>
    </article>
  );
}
