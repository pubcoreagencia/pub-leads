import { MessageCircle, Search, Target, TrendingUp, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { leadStatusLabels } from "@/config/pipeline";
import type { AnalyticsSummary } from "@/src/lib/analytics/summary";

type DashboardPageContentProps = {
  summary: AnalyticsSummary;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function formatUsage(current: number, limit: number | null) {
  return limit === null ? `${current.toLocaleString("pt-BR")} usados` : `${current} / ${limit}`;
}

export function DashboardPageContent({ summary }: DashboardPageContentProps) {
  const stats = [
    { label: "Leads", value: summary.totals.leads, icon: Users },
    { label: "Buscas", value: summary.totals.searches, icon: Search },
    { label: "Mensagens", value: summary.totals.messages, icon: MessageCircle },
    { label: "Conversão", value: `${summary.conversionRate}%`, icon: TrendingUp },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Dashboard</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Visão geral da operação comercial, uso do plano e pipeline.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card className="border-slate-200 bg-white shadow-sm" key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-950">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Uso do plano</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
              <p className="text-sm text-purple-700">Plano atual</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{summary.usage.plan.name}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Leads</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatUsage(summary.usage.leadsUsed, summary.usage.plan.limits.leadLimit)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Buscas no mês</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatUsage(summary.usage.searchesUsed, summary.usage.plan.limits.searchLimit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {summary.pipeline.map((item) => (
              <div className="flex items-center gap-3" key={item.label}>
                <div className="w-28 text-sm text-slate-500">{item.label}</div>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-purple-600"
                    style={{
                      width: `${summary.totals.leads > 0 ? Math.max((item.value / summary.totals.leads) * 100, item.value > 0 ? 8 : 0) : 0}%`,
                    }}
                  />
                </div>
                <div className="w-8 text-right text-sm font-medium text-slate-950">{item.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Leads recentes</CardTitle>
          <Target className="h-5 w-5 text-purple-600" />
        </CardHeader>
        <CardContent>
          {summary.recentLeads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              Nenhum lead cadastrado ainda.
            </div>
          ) : (
            <div className="grid gap-3">
              {summary.recentLeads.map((lead) => (
                <div
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={lead.id}
                >
                  <div>
                    <p className="font-medium text-slate-950">{lead.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {[lead.category, lead.city].filter(Boolean).join(" · ") || "Sem detalhes"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                      {leadStatusLabels[lead.status]}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(lead.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
