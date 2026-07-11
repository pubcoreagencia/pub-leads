import { CheckCircle2 } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/ops/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { billingPlans } from "@/config/billing-plans";
import { cn } from "@/lib/utils";
import type { UsageSummary } from "@/src/lib/usage/limits";

type PlansPageContentProps = {
  usage: UsageSummary;
};

function formatLimit(value: number | null, suffix = "") {
  return value === null ? "Ilimitado" : `${value.toLocaleString("pt-BR")}${suffix}`;
}

function formatUsage(current: number, limit: number | null) {
  return limit === null
    ? `${current.toLocaleString("pt-BR")} usados`
    : `${current.toLocaleString("pt-BR")} / ${limit.toLocaleString("pt-BR")}`;
}

export function PlansPageContent({ usage }: PlansPageContentProps) {
  return (
    <section className="space-y-6">
      <PageHeader
        actions={<StatusBadge tone={usage.plan.limits.leadLimit === null ? "amber" : "red"}>{usage.plan.name}</StatusBadge>}
        description="Acompanhe limites, uso mensal e diferenças entre planos. Cobrança fica na aba Assinatura."
        eyebrow="Plano e limites"
        title="Planos"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-red-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Plano atual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-950">{usage.plan.name}</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              WhatsApp manual está disponível em todos os planos do MVP.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Uso atual</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Leads</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatUsage(usage.leadsUsed, usage.plan.limits.leadLimit)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Buscas no mês</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatUsage(usage.searchesUsed, usage.plan.limits.searchLimit)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Comparação entre planos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {billingPlans.map((plan) => {
            const isCurrent = plan.id === usage.plan.id;

            return (
              <div
                className={cn(
                  "rounded-lg border border-slate-200 p-5",
                  isCurrent && "border-red-400 bg-red-50",
                  plan.lifetime && "border-amber-300 bg-amber-50/60",
                )}
                key={plan.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">{plan.type}</p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-950">{plan.name}</h2>
                  </div>
                  {isCurrent ? <CheckCircle2 className="h-5 w-5 text-red-700" /> : null}
                </div>
                <p className="mt-4 text-2xl font-semibold text-slate-950">{plan.price}</p>
                <dl className="mt-5 grid gap-3 text-sm text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt>Leads</dt>
                    <dd className="font-medium text-slate-950">{formatLimit(plan.leadLimit)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Buscas</dt>
                    <dd className="font-medium text-slate-950">{formatLimit(plan.searchLimit, "/mês")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>WhatsApp</dt>
                    <dd className="font-medium text-slate-950">
                      {formatLimit(plan.whatsappInstances)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Pipelines</dt>
                    <dd className="font-medium text-slate-950">
                      {formatLimit(plan.pipelineLimit)}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
