import { redirect } from "next/navigation";

import { AnalyticsPageContent } from "@/components/analytics/analytics-page-content";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAnalyticsSummary } from "@/src/lib/analytics/summary";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  if (!hasSupabaseConfig()) {
    redirect("/login?error=supabase-not-configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/app/analytics");
  }

  const summary = await getAnalyticsSummary(user.id);

  return <AnalyticsPageContent summary={summary} />;
}
