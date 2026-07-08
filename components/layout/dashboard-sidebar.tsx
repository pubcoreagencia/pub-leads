"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { dashboardNavItems } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/layout/logout-button";

type DashboardSidebarProps = {
  onNavigate?: () => void;
};

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white px-4 py-5">
      <Link className="mb-8 flex items-center gap-3 px-2" href="/app/dashboard" onClick={onNavigate}>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-slate-950">PubLeads</span>
          <span className="block text-xs text-slate-500">Sales workspace</span>
        </span>
      </Link>

      <nav className="grid gap-1">
        {dashboardNavItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-purple-50 hover:text-purple-700",
                active && "bg-purple-100 text-purple-700",
              )}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Plano vitalício</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            Espaço reservado para oferta premium em dourado.
          </p>
        </div>
        <LogoutButton className="w-full justify-start" />
      </div>
    </aside>
  );
}
