import type {
  BillablePlanId,
  BillingProvider,
  CheckoutRequest,
} from "@/src/lib/billing/types";
import { z } from "zod";

const checkoutUrlByPlan: Record<BillablePlanId, string | undefined> = {
  mensal: process.env.CHECKOUT_MENSAL_URL,
  anual: process.env.CHECKOUT_ANUAL_URL,
  vitalicio: process.env.CHECKOUT_VITALICIO_URL,
};

const fallbackUrlByPlan: Record<BillablePlanId, string> = {
  mensal: "/checkout/mensal",
  anual: "/checkout/anual",
  vitalicio: "/checkout/vitalicio",
};

const webhookEventSchema = z.object({
  amountCents: z.number().int().nonnegative().optional(),
  externalId: z.string().min(1).optional(),
  planId: z.enum(["mensal", "anual", "vitalicio"]),
  type: z.enum(["checkout.completed", "subscription.canceled", "payment.failed"]),
});

export const mockBillingProvider: BillingProvider = {
  id: "mock",
  async createCheckoutSession(request: CheckoutRequest) {
    const configuredUrl = checkoutUrlByPlan[request.planId];
    const checkoutUrl = configuredUrl?.trim() || fallbackUrlByPlan[request.planId];

    return {
      planId: request.planId,
      checkoutUrl,
      provider: "mock",
    };
  },
  async parseWebhook(payload: unknown) {
    const parsed = webhookEventSchema.safeParse(payload);

    if (!parsed.success) {
      throw new Error("Webhook mock invalido.");
    }

    return parsed.data;
  },
};
