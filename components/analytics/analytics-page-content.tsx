"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, MessageCircle, Search, Target, TrendingUp, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary, ChartPoint } from "@/src/lib/analytics/summary";

type AnalyticsPageContentProps = {
  summary: AnalyticsSummary;
};

const chartColors = ["#7c3aed", "#d4a017", "#0f766e", "#2563eb", "#db2777", "#475569"];

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function hasData(points: ChartPoint[]) {
  return points.some((point) => point.value > 0);
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function ChartCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AnalyticsPageContent({ summary }: AnalyticsPageContentProps) {
  const stats = [
    { label: "Leads captados", value: summary.totals.leads, icon: Users },
    { label: "Buscas feitas", value: summary.totals.searches, icon: Search },
    { label: "Mensagens geradas", value: summary.totals.messages, icon: MessageCircle },
    { label: "Taxa de conversão", value: `${summary.conversionRate}%`, icon: TrendingUp },
  ];
  const activeSources = summary.sources.filter((source) => source.value > 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Analytics</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Acompanhe aquisição de leads, buscas e evolução do pipeline.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
          <BarChart3 className="h-3.5 w-3.5" />
          Dados comerciais
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card className="border-slate-200 bg-white shadow-sm" key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-950">
                {typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          description="Leads criados nos últimos 7 dias."
          title="Aquisição de leads"
        >
          {hasData(summary.leadsByDay) ? (
            <div className="h-[280px]">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={summary.leadsByDay} margin={{ bottom: 0, left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                  <Tooltip />
                  <Line
                    activeDot={{ r: 6 }}
                    dataKey="value"
                    name="Leads"
                    stroke="#7c3aed"
                    strokeWidth={3}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="Nenhum lead criado no período." />
          )}
        </ChartCard>

        <ChartCard description="Buscas registradas no mês atual." title="Volume de buscas">
          {hasData(summary.searchesByDay) ? (
            <div className="h-[280px]">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={summary.searchesByDay} margin={{ bottom: 0, left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" name="Buscas" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="Nenhuma busca registrada no período." />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard description="Distribuição dos leads por etapa comercial." title="Pipeline">
          {hasData(summary.pipeline) ? (
            <div className="h-[320px]">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={summary.pipeline} layout="vertical" margin={{ bottom: 0, left: 24, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} />
                  <XAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} type="number" />
                  <YAxis
                    dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                    type="category"
                    width={90}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" name="Leads" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="O pipeline ainda não possui leads." />
          )}
        </ChartCard>

        <ChartCard description="Origem dos leads já cadastrados." title="Fontes">
          {activeSources.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr] xl:grid-cols-1">
              <div className="h-[220px]">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      data={activeSources}
                      dataKey="value"
                      innerRadius={58}
                      nameKey="label"
                      outerRadius={92}
                      paddingAngle={3}
                    >
                      {activeSources.map((source, index) => (
                        <Cell fill={chartColors[index % chartColors.length]} key={source.label} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid content-center gap-2">
                {activeSources.map((source, index) => (
                  <div className="flex items-center justify-between gap-3 text-sm" key={source.label}>
                    <span className="flex items-center gap-2 text-slate-600">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: chartColors[index % chartColors.length] }}
                      />
                      {source.label}
                    </span>
                    <span className="font-medium text-slate-950">{source.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart label="Nenhuma fonte com leads cadastrados." />
          )}
        </ChartCard>
      </div>

      <ChartCard description="Categorias com maior presença na base." title="Top categorias">
        {summary.categories.length > 0 ? (
          <div className="grid gap-3">
            {summary.categories.map((category, index) => (
              <div className="flex items-center gap-3" key={category.label}>
                <div className="w-36 truncate text-sm text-slate-600">{category.label}</div>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      backgroundColor: chartColors[index % chartColors.length],
                      width: `${Math.max((category.value / summary.totals.leads) * 100, 8)}%`,
                    }}
                  />
                </div>
                <div className="w-10 text-right text-sm font-medium text-slate-950">{category.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            As categorias aparecerão quando leads forem cadastrados.
          </div>
        )}
      </ChartCard>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Resumo operacional</CardTitle>
            <CardDescription>Uso do plano e resultado comercial atual.</CardDescription>
          </div>
          <Target className="h-5 w-5 text-purple-600" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Plano</p>
            <p className="mt-2 font-semibold text-slate-950">{summary.usage.plan.name}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Leads usados</p>
            <p className="mt-2 font-semibold text-slate-950">{summary.usage.leadsUsed}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Buscas no mês</p>
            <p className="mt-2 font-semibold text-slate-950">{summary.usage.searchesUsed}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Leads fechados</p>
            <p className="mt-2 font-semibold text-slate-950">{summary.totals.won}</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
