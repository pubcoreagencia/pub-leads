import { createClient } from "@/lib/supabase/server";
import { countLeads } from "@/src/lib/turso/leads-repository";
import {
  countSearchesThisMonth,
  createSearchLog,
} from "@/src/lib/turso/search-logs-repository";
import {
  internalUnlimitedPlanId,
  isInternalUnlimitedEmail,
} from "@/src/lib/usage/internal-unlimited";

export type AppPlanId = "free" | "mensal" | "anual" | "vitalicio";

export type PlanLimits = {
  leadLimit: number | null;
  searchLimit: number | null;
  whatsappInstanceLimit: number | null;
  pipelineLimit: number | null;
  whatsappManual: boolean;
};

export type CurrentPlan = {
  id: AppPlanId;
  name: string;
  limits: PlanLimits;
};

export type UsageSummary = {
  plan: CurrentPlan;
  leadsUsed: number;
  searchesUsed: number;
  canSearch: boolean;
  canCreateLead: boolean;
};

export const planLimitsById: Record<AppPlanId, CurrentPlan> = {
  free: {
    id: "free",
    name: "Free",
    limits: {
      leadLimit: 100,
      pipelineLimit: 1,
      searchLimit: 5,
      whatsappInstanceLimit: 1,
      whatsappManual: true,
    },
  },
  mensal: {
    id: "mensal",
    name: "Plano Mensal",
    limits: {
      leadLimit: 10000,
      pipelineLimit: 3,
      searchLimit: 50,
      whatsappInstanceLimit: 2,
      whatsappManual: true,
    },
  },
  anual: {
    id: "anual",
    name: "Plano Anual",
    limits: {
      leadLimit: null,
      pipelineLimit: null,
      searchLimit: null,
      whatsappInstanceLimit: 10,
      whatsappManual: true,
    },
  },
  vitalicio: {
    id: "vitalicio",
    name: "Plano Vitalício",
    limits: {
      leadLimit: null,
      pipelineLimit: null,
      searchLimit: null,
      whatsappInstanceLimit: null,
      whatsappManual: true,
    },
  },
};

function normalizePlanId(value: string | null | undefined): AppPlanId {
  if (value === "mensal" || value === "anual" || value === "vitalicio") {
    return value;
  }

  return "free";
}

async function resolveCurrentUserEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userEmail?: string | null,
) {
  if (userEmail) {
    return userEmail;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === userId) {
    return user.email;
  }

  return null;
}

export async function getCurrentPlan(
  userId: string,
  userEmail?: string | null,
): Promise<CurrentPlan> {
  const supabase = await createClient();
  const resolvedEmail = await resolveCurrentUserEmail(supabase, userId, userEmail);

  if (isInternalUnlimitedEmail(resolvedEmail)) {
    return planLimitsById[internalUnlimitedPlanId];
  }

  const { data } = await supabase
    .from("profiles")
    .select("current_plan_id")
    .eq("id", userId)
    .maybeSingle();

  const planId = normalizePlanId((data as { current_plan_id?: string } | null)?.current_plan_id);

  return planLimitsById[planId];
}

export async function getUsageSummary(
  userId: string,
  userEmail?: string | null,
): Promise<UsageSummary> {
  const plan = await getCurrentPlan(userId, userEmail);
  const [leadCount, searchCount] = await Promise.all([
    countLeads(userId),
    countSearchesThisMonth(userId),
  ]);

  return {
    canCreateLead: plan.limits.leadLimit === null || leadCount < plan.limits.leadLimit,
    canSearch: plan.limits.searchLimit === null || searchCount < plan.limits.searchLimit,
    leadsUsed: leadCount,
    plan,
    searchesUsed: searchCount,
  };
}

export async function canSearch(userId: string, userEmail?: string | null) {
  return (await getUsageSummary(userId, userEmail)).canSearch;
}

export async function canCreateLead(userId: string, userEmail?: string | null) {
  return (await getUsageSummary(userId, userEmail)).canCreateLead;
}

export async function incrementSearchUsage(userId: string) {
  await createSearchLog(userId, {
    category: "usage",
    query: "manual usage increment",
    result_count: 0,
    source: "openstreetmap",
    status: "success",
    raw_params: { incrementOnly: true },
  });
}
