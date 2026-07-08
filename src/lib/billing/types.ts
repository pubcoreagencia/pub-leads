export type BillablePlanId = "mensal" | "anual" | "vitalicio";

export type CheckoutRequest = {
  planId: BillablePlanId;
  userId: string;
  email?: string | null;
};

export type CheckoutSession = {
  planId: BillablePlanId;
  checkoutUrl: string;
  provider: "mock";
};

export type BillingWebhookEvent = {
  type: "checkout.completed" | "subscription.canceled" | "payment.failed";
  planId: BillablePlanId;
  amountCents?: number;
  externalId?: string;
};

export type BillingProvider = {
  id: "mock";
  createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession>;
  parseWebhook(payload: unknown): Promise<BillingWebhookEvent>;
};
