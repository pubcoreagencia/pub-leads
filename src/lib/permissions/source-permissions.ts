import { isInternalUnlimitedEmail } from "@/src/lib/usage/internal-unlimited";
import { getCurrentPlan } from "@/src/lib/usage/limits";

export const defaultLeadSearchSource = "site_sales";

export type LeadSearchSourceId =
  | "site_sales"
  | "openstreetmap"
  | "cnpj_brasil"
  | "google_places";

type SourcePermissionUser = {
  email?: string | null;
  id: string;
};

export async function canSelectLeadSource(user: SourcePermissionUser) {
  if (isInternalUnlimitedEmail(user.email)) {
    return true;
  }

  const plan = await getCurrentPlan(user.id, user.email);

  return plan.id === "vitalicio";
}

export async function canUseLeadSearchSource(
  user: SourcePermissionUser,
  source: LeadSearchSourceId,
) {
  if (source === defaultLeadSearchSource) {
    return true;
  }

  return canSelectLeadSource(user);
}
