"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/layout/logout-button";
import { dashboardNavItems } from "@/config/navigation";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function DashboardSidebar({ collapsed = false, onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-r border-red-950 bg-[linear-gradient(180deg,#170204_0%,#260407_44%,#09090b_100%)] py-5 text-white transition-all",
        collapsed ? "px-3" : "px-4",
      )}
    >
      <Link className={cn("mb-6 block pr-10 lg:pr-1", collapsed ? "px-0" : "px-1")} href="/app/dashboard" onClick={onNavigate}>
        <span className={cn("flex items-center rounded-lg", collapsed ? "h-12 justify-center" : "h-20 px-2")}>
          {collapsed ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-lg font-black tracking-tighter text-red-700">
              P
            </span>
          ) : (
            <Image
              alt="PubLeads"
              className="h-16 w-auto object-contain"
              height={88}
              src="/brand/publeads-logo.png"
              width={180}
            />
          )}
        </span>
      </Link>

      <nav className="grid flex-1 content-start gap-1 overflow-y-auto pr-1">
        {dashboardNavItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              className={cn(
                "flex h-10 items-center rounded-md text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active && "bg-white text-slate-950 shadow-sm",
              )}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {collapsed ? null : item.title}
            </Link>
          );
        })}
      </nav>

      <div className={cn("mt-auto space-y-3", collapsed && "flex flex-col items-center")}>
        {collapsed ? null : (
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageCircle className="h-4 w-4 text-emerald-300" />
              Próxima ação
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Abra a fila de abordagem para continuar contatos manuais sem perder contexto.
            </p>
            <Link
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-red-200 hover:text-white"
              href="/app/whatsapp"
              onClick={onNavigate}
            >
              Ir para abordagem
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        <LogoutButton
          className={cn(
            "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
            collapsed ? "h-10 w-10" : "w-full justify-start",
          )}
          compact={collapsed}
        />
      </div>
    </aside>
  );
}
