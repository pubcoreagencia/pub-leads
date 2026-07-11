import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  actions?: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
};

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

type SectionCardProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  title?: string;
};

export function SectionCard({ actions, children, className, description, title }: SectionCardProps) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {title || actions ? (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="text-base font-semibold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

type MetricCardProps = {
  accent?: "red" | "emerald" | "blue" | "amber" | "slate" | "pink";
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  helper?: string;
};

const metricAccent = {
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  pink: "bg-pink-50 text-pink-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-700",
};

export function MetricCard({ accent = "red", helper, icon: Icon, label, value }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", metricAccent[accent])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {helper ? <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  );
}

type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
};

export function EmptyState({ action, description, icon: Icon, title }: EmptyStateProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
      <div className="mb-4 rounded-lg bg-white p-3 text-red-700 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
      <span className="mr-2 h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
      {label}
    </div>
  );
}

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "emerald" | "blue" | "amber" | "red" | "slate" | "pink";
};

const badgeTone = {
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusBadge({ children, tone = "slate" }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", badgeTone[tone])}>
      {children}
    </span>
  );
}

export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      {children}
    </div>
  );
}
