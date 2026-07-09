import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  internalUnlimitedPlanName,
  isInternalUnlimitedEmail,
} from "@/src/lib/usage/internal-unlimited";

type ProfileSummary = {
  full_name: string | null;
  plans: {
    name: string | null;
  } | null;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!hasSupabaseConfig()) {
    redirect("/login?error=supabase-not-configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/app/dashboard");
  }

  const { data } = await supabase
    .from("profiles")
    .select("full_name, plans(name)")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as ProfileSummary | null;
  const userName = profile?.full_name ?? user.user_metadata.full_name ?? user.email ?? "Usuário";
  const currentPlan = isInternalUnlimitedEmail(user.email)
    ? internalUnlimitedPlanName
    : (profile?.plans?.name ?? "Free");

  return (
    <DashboardShell
      currentPlan={currentPlan}
      userInitials={initialsFromName(userName) || "PL"}
      userName={userName}
    >
      {children}
    </DashboardShell>
  );
}
