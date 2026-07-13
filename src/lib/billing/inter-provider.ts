import type {
  BillingProvider,
  BillingWebhookEvent,
  CheckoutRequest,
} from "@/src/lib/billing/types";
import {
  createInterIntegrationBlockedError,
  getInterMissingConfigKeys,
  hasInterConfig,
} from "@/src/lib/billing/inter/client";

export const interBillingProvider: BillingProvider = {
  configured: hasInterConfig(),
  id: "inter",
  async createCheckoutSession(_request: CheckoutRequest) {
    void _request;
    const missing = getInterMissingConfigKeys();

    if (missing.length > 0) {
      throw new Error(`Banco Inter não configurado. Variáveis ausentes: ${missing.join(", ")}.`);
    }

    throw createInterIntegrationBlockedError();
  },
  async parseWebhook(_payload: unknown): Promise<BillingWebhookEvent> {
    void _payload;
    throw createInterIntegrationBlockedError();
  },
};
