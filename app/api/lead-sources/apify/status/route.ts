import { NextResponse } from "next/server";

import { getApifyMonthlyBudget } from "@/src/lib/apify/budget";
import { hasApifyConfig } from "@/src/lib/apify/client";
import { createClient } from "@/lib/supabase/server";
import { canUseLeadSearchSource } from "@/src/lib/permissions/source-permissions";
import { getApifyMonthlySpend } from "@/src/lib/turso/apify-runs-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ available: false, reason: "not_internal_user" }, { status: 401 });
  }

  if (!(await canUseLeadSearchSource(user, "apify_google_maps"))) {
    return NextResponse.json({ available: false, reason: "not_internal_user" });
  }

  if (!hasApifyConfig()) {
    return NextResponse.json({ available: false, reason: "missing_token" });
  }

  const monthlyBudgetUsd = getApifyMonthlyBudget();
  const usedBudgetUsd = await getApifyMonthlySpend(user.id);

  if (usedBudgetUsd >= monthlyBudgetUsd) {
    return NextResponse.json({ available: false, reason: "budget_exceeded", monthlyBudgetUsd, usedBudgetUsd });
  }

  return NextResponse.json({ available: true, reason: "ok", monthlyBudgetUsd, usedBudgetUsd });
}
