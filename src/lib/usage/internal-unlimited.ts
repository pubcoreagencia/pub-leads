export const internalUnlimitedPlanId = "vitalicio";
export const internalUnlimitedPlanName = "Plano Vitalício";

export function getInternalUnlimitedEmails() {
  return (process.env.INTERNAL_UNLIMITED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isInternalUnlimitedEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getInternalUnlimitedEmails().includes(email.trim().toLowerCase());
}
