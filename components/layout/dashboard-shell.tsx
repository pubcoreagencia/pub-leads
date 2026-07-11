"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

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
        <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden">
          <div className="h-full w-72 max-w-[86vw] bg-slate-950">
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
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
