import { getInterEnvironment, hasInterConfig } from "@/src/lib/billing/inter/client";
import { interBillingProvider } from "@/src/lib/billing/inter-provider";
import { mockBillingProvider } from "@/src/lib/billing/mock-provider";
import type { BillingProviderId, BillingRuntimeStatus } from "@/src/lib/billing/types";

export function getBillingProviderId(): BillingProviderId {
  return process.env.BILLING_PROVIDER === "inter" ? "inter" : "mock";
}

export function getBillingProvider() {
  return getBillingProviderId() === "inter" ? interBillingProvider : mockBillingProvider;
}

export function getBillingRuntimeStatus(): BillingRuntimeStatus {
  const billingProvider = getBillingProviderId();

  if (billingProvider === "inter") {
    return {
      billingConfigured: hasInterConfig(),
      billingProvider,
      environment: getInterEnvironment(),
    };
  }

  return {
    billingConfigured: true,
    billingProvider,
    environment: "mock",
  };
}
