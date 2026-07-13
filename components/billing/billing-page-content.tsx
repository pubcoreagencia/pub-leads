"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/ops/page";
import { PlanCard } from "@/components/billing/plan-card";
import { paidBillingPlans, type BillingPlanId } from "@/config/billing-plans";
import { toast } from "@/hooks/use-toast";
import { attributionStorageKey, sanitizeAttributionParams } from "@/src/lib/tracking/utms";

type CheckoutResponse = {
  checkoutUrl?: string;
  error?: string;
};

export function BillingPageContent() {
  const router = useRouter();
  const [loadingPlanId, setLoadingPlanId] = useState<BillingPlanId | null>(null);
  const showDevCheckoutNotice = process.env.NODE_ENV !== "production";

  function getStoredAttribution() {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const stored = window.localStorage.getItem(attributionStorageKey);
      const parsed = stored ? JSON.parse(stored) as { params?: unknown } : null;

      return sanitizeAttributionParams(parsed?.params);
    } catch {
      return {};
    }
  }

  async function handleSubscribe(planId: BillingPlanId) {
    if (planId === "free") {
      return;
    }

    setLoadingPlanId(planId);

    try {
      const response = await fetch("/api/billing/checkout", {
        body: JSON.stringify({ planId, utms: getStoredAttribution() }),
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
      <PageHeader
        actions={<StatusBadge tone="red">Gestao de cobranca</StatusBadge>}
        description="Gerencie assinatura e pagamentos sem misturar isso com a tela de uso do plano."
        eyebrow="Assinatura"
        title="Assinatura"
      />

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-950">Escolha seu plano</h2>
        <p className="text-sm text-slate-500">Clique no plano desejado para assinar.</p>
        {showDevCheckoutNotice ? (
          <p className="text-xs leading-5 text-amber-700">
            Ambiente de desenvolvimento: checkout simulado enquanto a cobrança real não está conectada.
          </p>
        ) : null}
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
