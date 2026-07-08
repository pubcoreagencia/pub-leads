"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { PlanCard } from "@/components/billing/plan-card";
import { paidBillingPlans, type BillingPlanId } from "@/config/billing-plans";
import { toast } from "@/hooks/use-toast";

type CheckoutResponse = {
  checkoutUrl?: string;
  error?: string;
};

export function BillingPageContent() {
  const router = useRouter();
  const [loadingPlanId, setLoadingPlanId] = useState<BillingPlanId | null>(null);

  async function handleSubscribe(planId: BillingPlanId) {
    if (planId === "free") {
      return;
    }

    setLoadingPlanId(planId);

    try {
      const response = await fetch("/api/billing/checkout", {
        body: JSON.stringify({ planId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as CheckoutResponse;

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "Nao foi possivel iniciar checkout.");
      }

      if (payload.checkoutUrl.startsWith("http")) {
        window.location.href = payload.checkoutUrl;
      } else {
        router.push(payload.checkoutUrl);
      }
    } catch (error) {
      toast({
        title: "Erro no checkout",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setLoadingPlanId(null);
    }
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            Checkout
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Billing</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Gerencie sua assinatura e pagamentos
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-950">Escolha seu plano</h2>
        <p className="text-sm text-slate-500">Clique no plano desejado para assinar.</p>
        <p className="text-xs leading-5 text-amber-700">
          Checkout mock de desenvolvimento: os links abaixo servem apenas para simular a navegação enquanto
          a cobrança real não é conectada.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {paidBillingPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            loading={loadingPlanId === plan.id}
            loadingIcon={<Loader2 className="h-4 w-4 animate-spin" />}
            onSubscribe={handleSubscribe}
            plan={plan}
          />
        ))}
      </div>
    </section>
  );
}
