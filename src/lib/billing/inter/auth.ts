import { createInterIntegrationBlockedError } from "@/src/lib/billing/inter/client";

export async function getInterAccessToken() {
  throw createInterIntegrationBlockedError();
}
