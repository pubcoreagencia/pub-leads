import type { BillablePlanId, BillingCurrency } from "@/src/lib/billing/types";

export type BillablePlan = {
  billingInterval: "month" | "year" | "lifetime";
  currency: BillingCurrency;
  id: BillablePlanId;
  name: string;
  priceCents: number;
  type: "subscription" | "lifetime";
};

export const billablePlans: Record<BillablePlanId, BillablePlan> = {
  anual: {
    billingInterval: "year",
    currency: "BRL",
    id: "anual",
    name: "Plano Anual",
    priceCents: 49799,
    type: "subscription",
  },
  mensal: {
    billingInterval: "month",
    currency: "BRL",
    id: "mensal",
    name: "Plano Mensal",
    priceCents: 14799,
    type: "subscription",
  },
  vitalicio: {
    billingInterval: "lifetime",
    currency: "BRL",
    id: "vitalicio",
    name: "Plano Vitalício",
    priceCents: 99798,
    type: "lifetime",
  },
};

export function getBillablePlan(planId: BillablePlanId) {
  return billablePlans[planId];
}
