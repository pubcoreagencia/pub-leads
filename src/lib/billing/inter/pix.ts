import type { CheckoutRequest } from "@/src/lib/billing/types";
import { createInterIntegrationBlockedError } from "@/src/lib/billing/inter/client";

export async function createInterPixCharge(_request: CheckoutRequest) {
  void _request;
  throw createInterIntegrationBlockedError();
}

export async function getInterPixChargeStatus(_txid: string) {
  void _txid;
  throw createInterIntegrationBlockedError();
}
