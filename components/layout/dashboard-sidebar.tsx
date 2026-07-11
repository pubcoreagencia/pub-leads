"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/layout/logout-button";
import { dashboardNavItems } from "@/config/navigation";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = { onNavigate?: () => void };

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-900 bg-slate-950 px-4 py-5 text-white">
      <Link className="mb-7 block px-1" href="/app/dashboard" onClick={onNavigate}>
        <span className="flex h-20 items-center rounded-lg bg-white px-4 shadow-sm">
          <Image
            alt="PubLeads"
            className="h-16 w-auto object-contain"
            height={88}
            src="/brand/publeads-logo.png"
            width={140}
          />
        </span>
      </Link>

      <nav className="grid gap-1">
        {dashboardNavItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return <Link className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white", active && "bg-white text-slate-950 shadow-sm")} href={item.href} key={item.href} onClick={onNavigate}><item.icon className="h-4 w-4" />{item.title}</Link>;
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageCircle className="h-4 w-4 text-emerald-300" />
            Próxima ação
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-300">Abra a fila de abordagem para continuar contatos manuais sem perder contexto.</p>
          <Link
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-200 hover:text-white"
            href="/app/whatsapp"
            onClick={onNavigate}
          >
            Ir para abordagem
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <LogoutButton className="w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white" />
      </div>
    </aside>
  );
}
