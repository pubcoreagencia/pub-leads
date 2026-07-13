import type { AttributionParams } from "@/src/lib/tracking/types";

export type BillablePlanId = "mensal" | "anual" | "vitalicio";
export type BillingProviderId = "mock" | "inter";
export type BillingCurrency = "BRL";

export type CheckoutStatus = "pending" | "paid" | "failed" | "expired" | "mock";

export type CheckoutRequest = {
  planId: BillablePlanId;
  userId: string;
  amountCents: number;
  currency: BillingCurrency;
  email?: string | null;
  metadata?: Record<string, unknown>;
  paymentId?: string | null;
  utms?: AttributionParams;
};

export type CheckoutSession = {
  planId: BillablePlanId;
  provider: BillingProviderId;
  checkoutUrl: string;
  paymentId?: string | null;
  pixCopyPaste?: string | null;
  pixQrCode?: string | null;
  status: CheckoutStatus;
  expiresAt?: string | null;
};

export type BillingWebhookEvent = {
  type: "checkout.completed" | "subscription.canceled" | "payment.failed";
  planId: BillablePlanId;
  amountCents?: number;
  externalId?: string;
};

export type BillingProvider = {
  id: BillingProviderId;
  configured: boolean;
  createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession>;
  parseWebhook(payload: unknown): Promise<BillingWebhookEvent>;
};

export type BillingRuntimeStatus = {
  billingConfigured: boolean;
  billingProvider: BillingProviderId;
  environment: "sandbox" | "production" | "mock";
};
