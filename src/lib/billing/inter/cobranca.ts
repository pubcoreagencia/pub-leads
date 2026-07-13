import type { CheckoutRequest } from "@/src/lib/billing/types";
import { createInterIntegrationBlockedError } from "@/src/lib/billing/inter/client";

export async function createInterCobranca(_request: CheckoutRequest) {
  void _request;
  throw createInterIntegrationBlockedError();
}

export async function getInterCobrancaStatus(_chargeId: string) {
  void _chargeId;
  throw createInterIntegrationBlockedError();
}
