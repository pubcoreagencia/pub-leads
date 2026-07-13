"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { X } from "lucide-react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

type DashboardShellProps = Readonly<{
  children: ReactNode;
  currentPlan: string;
  userInitials: string;
  userName: string;
}>;

export function DashboardShell({
  children,
  currentPlan,
  userInitials,
  userName,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <div className="relative h-full w-72 max-w-[86vw] overflow-y-auto bg-[linear-gradient(180deg,#170204_0%,#260407_44%,#09090b_100%)] shadow-2xl">
            <button
              aria-label="Fechar menu"
              className="absolute right-3 top-3 z-10 rounded-md bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
            <DashboardSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72">
        <DashboardSidebar />
      </div>

      <div className="lg:pl-72">
        <DashboardHeader
          currentPlan={currentPlan}
          onMenuClick={() => setMobileOpen(true)}
          userInitials={userInitials}
          userName={userName}
        />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-6 lg:pb-8">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
