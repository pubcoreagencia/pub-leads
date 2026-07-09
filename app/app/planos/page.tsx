import { redirect } from "next/navigation";

import { PlansPageContent } from "@/components/plans/plans-page-content";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/src/lib/usage/limits";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  if (!hasSupabaseConfig()) {
    redirect("/login?error=supabase-not-configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/app/planos");
  }

  const usage = await getUsageSummary(user.id, user.email);

  return <PlansPageContent usage={usage} />;
}
