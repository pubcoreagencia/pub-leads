import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { hasApifyConfig } from "@/src/lib/apify/client";
import { getApifyMonthlyBudget } from "@/src/lib/apify/budget";
import { getApifySources } from "@/src/lib/apify/source-registry";
import { canSelectLeadSource } from "@/src/lib/permissions/source-permissions";
import { getApifyMonthlySpend } from "@/src/lib/turso/apify-runs-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ available: false, reason: "not_internal_user", sources: [] }, { status: 401 });
  }

  if (!(await canSelectLeadSource(user))) {
    return NextResponse.json({ available: false, reason: "not_internal_user", sources: [] });
  }

  if (!hasApifyConfig()) {
    return NextResponse.json({ available: false, reason: "missing_token", sources: [] });
  }

  const [sources, usedBudgetUsd] = await Promise.all([
    getApifySources(user.id),
    getApifyMonthlySpend(user.id),
  ]);
  const monthlyBudgetUsd = getApifyMonthlyBudget();

  return NextResponse.json({
    available: usedBudgetUsd < monthlyBudgetUsd,
    monthlyBudgetUsd,
    reason: usedBudgetUsd >= monthlyBudgetUsd ? "budget_exceeded" : "ok",
    sources,
    usedBudgetUsd,
  });
}
