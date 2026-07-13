import type { CheckoutRequest } from "@/src/lib/billing/types";

export function mapCheckoutToInterReference(request: CheckoutRequest) {
  return {
    amountCents: request.amountCents,
    currency: request.currency,
    customerEmail: request.email ?? null,
    paymentId: request.paymentId ?? null,
    planId: request.planId,
    userId: request.userId,
  };
}
