import type { ReactNode } from "react";

type DashboardPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function DashboardPageShell({
  title,
  description,
  children,
}: DashboardPageShellProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}
