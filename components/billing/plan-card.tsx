import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BillingPlan } from "@/config/billing-plans";
import { cn } from "@/lib/utils";

type PlanCardProps = {
  loading?: boolean;
  loadingIcon?: ReactNode;
  plan: BillingPlan;
  onSubscribe: (planId: BillingPlan["id"]) => void;
};

export function PlanCard({ loading = false, loadingIcon, plan, onSubscribe }: PlanCardProps) {
  const Icon = plan.icon;

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-premium",
        plan.featured && "border-purple-500 shadow-premium",
        plan.lifetime && "border-amber-300 bg-amber-50/45",
      )}
    >
      {plan.badge ? (
        <div
          className={cn(
            "absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
            plan.lifetime
              ? "bg-amber-100 text-amber-800"
              : "bg-purple-100 text-purple-700",
          )}
        >
          {plan.badge}
        </div>
      ) : null}

      <CardContent className="flex h-full flex-col p-6">
        <div
          className={cn(
            "mb-5 flex h-11 w-11 items-center justify-center rounded-lg",
            plan.lifetime ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="space-y-2 pr-16">
          <p className="text-xs font-semibold tracking-wide text-slate-500">{plan.type}</p>
          <h2 className="text-xl font-semibold text-slate-950">{plan.name}</h2>
        </div>

        <div className="mt-6">
          <p className="text-3xl font-semibold tracking-normal text-slate-950">{plan.price}</p>
          {plan.note ? (
            <p className="mt-3 text-sm font-medium text-emerald-600">{plan.note}</p>
          ) : null}
        </div>

        <ul className="mt-6 grid gap-3 text-sm text-slate-600">
          {plan.benefits.map((benefit) => (
            <li className="flex items-start gap-2" key={benefit}>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-700">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <Button
          className={cn(
            "mt-8 w-full",
            plan.lifetime &&
              "bg-amber-500 text-amber-950 hover:bg-amber-400 focus-visible:ring-amber-400",
          )}
          disabled={loading}
          onClick={() => onSubscribe(plan.id)}
          type="button"
        >
          {loading ? loadingIcon : null}
          {loading ? "Abrindo..." : plan.buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
