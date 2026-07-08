"use client";

import { X } from "lucide-react";

import type { ToastMessage } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ToastProps = {
  message: ToastMessage;
  onDismiss: (id: string) => void;
};

export function Toast({ message, onDismiss }: ToastProps) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-lg border bg-white p-4 shadow-premium",
        message.variant === "success" && "border-emerald-200",
        message.variant === "error" && "border-red-200",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-1 h-2.5 w-2.5 rounded-full",
            message.variant === "success" ? "bg-emerald-500" : "bg-red-500",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">{message.title}</p>
          {message.description ? (
            <p className="mt-1 text-sm leading-5 text-slate-500">{message.description}</p>
          ) : null}
        </div>
        <button
          aria-label="Fechar notificacao"
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          onClick={() => onDismiss(message.id)}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
