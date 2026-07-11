"use client";

import { Menu, Search, Settings } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/layout/logout-button";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  currentPlan: string;
  onMenuClick: () => void;
  userInitials: string;
  userName: string;
};

export function DashboardHeader({
  currentPlan,
  onMenuClick,
  userInitials,
  userName,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button className="lg:hidden" onClick={onMenuClick} size="icon" variant="ghost">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden h-10 max-w-xl flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 md:flex">
          <Search className="h-4 w-4" />
          Buscar leads, empresas, cidades ou Instagram
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline-flex">
            {currentPlan}
          </span>
          <Button asChild size="icon" variant="ghost">
            <Link href="/app/config">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-950">{userName}</p>
            <p className="text-xs text-slate-500">Workspace ativo</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
            {userInitials}
          </div>
          <LogoutButton compact />
        </div>
      </div>
    </header>
  );
}
