import Link from "next/link";
import {
  ArrowRight,
  Globe2,
  Instagram,
  MessageCircle,
  Search,
  Target,
  Users,
} from "lucide-react";

import { ActionBar, EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "@/components/ops/page";
import { Button } from "@/components/ui/button";
import { leadStatusLabels } from "@/config/pipeline";
import type { AnalyticsSummary } from "@/src/lib/analytics/summary";

type DashboardPageContentProps = { summary: AnalyticsSummary };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function formatUsage(current: number, limit: number | null) {
  return limit === null ? `${current.toLocaleString("pt-BR")} usados` : `${current} / ${limit}`;
}

export function DashboardPageContent({ summary }: DashboardPageContentProps) {
  const noUsefulChannel = Math.max(
    summary.totals.leads - summary.qualification.possibleWhatsapp - summary.qualification.withInstagram,
    0,
  );

  return (
    <section className="space-y-6">
      <PageHeader
        actions={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/app/scraper">
                Nova prospecção
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full sm:w-auto" variant="outline">
              <Link href="/app/whatsapp">Abrir abordagem</Link>
            </Button>
          </div>
        )}
        description="Veja o que precisa de atenção agora: qualidade da base, canais disponíveis, pipeline e próximas ações."
        eyebrow="Cockpit operacional"
        title="Dashboard"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard accent="red" helper="Base salva no Turso" icon={Users} label="Leads totais" value={summary.totals.leads} />
        <MetricCard accent="blue" helper="Buscas registradas" icon={Search} label="Buscas" value={summary.totals.searches} />
        <MetricCard accent="emerald" helper="Possível ou confirmado" icon={MessageCircle} label="Com WhatsApp" value={summary.qualification.possibleWhatsapp} />
        <MetricCard accent="pink" helper="Canal alternativo" icon={Instagram} label="Com Instagram" value={summary.qualification.withInstagram} />
        <MetricCard accent="amber" helper="Precisa de outra abordagem" icon={Globe2} label="Sem canal útil" value={noUsefulChannel} />
        <MetricCard accent="slate" helper="Base com dados acionáveis" icon={Target} label="Taxa qualificada" value={`${summary.qualification.qualificationRate}%`} />
      </div>

      <ActionBar>
        <div>
          <p className="text-sm font-semibold text-slate-950">O que fazer agora</p>
          <p className="text-sm text-slate-500">Priorize leads com WhatsApp/Instagram, salve os bons e mova oportunidades no pipeline.</p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button asChild size="sm" variant="outline"><Link href="/app/leads?qualification=with_instagram">Ver leads com Instagram</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/app/pipeline">Ver pipeline</Link></Button>
          <Button asChild size="sm"><Link href="/app/scraper">Buscar leads</Link></Button>
        </div>
      </ActionBar>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard description="Limites e uso precisam orientar ritmo de prospecção." title="Operação atual">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <p className="text-sm text-red-700">Plano atual</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{summary.usage.plan.name}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Leads usados</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{formatUsage(summary.usage.leadsUsed, summary.usage.plan.limits.leadLimit)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Buscas no mês</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{formatUsage(summary.usage.searchesUsed, summary.usage.plan.limits.searchLimit)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Conversão</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{summary.conversionRate}%</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard description="Identifique gargalos antes de prospectar mais." title="Pipeline resumido">
          <div className="grid gap-3">
            {summary.pipeline.map((item) => (
              <div className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3" key={item.label}>
                <div className="truncate text-sm text-slate-600">{item.label}</div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full bg-red-600"
                    style={{ width: `${summary.totals.leads > 0 ? Math.max((item.value / summary.totals.leads) * 100, item.value > 0 ? 8 : 0) : 0}%` }}
                  />
                </div>
                <div className="text-right text-sm font-semibold text-slate-950">{item.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        actions={<Button asChild size="sm" variant="outline"><Link href="/app/leads">Abrir base</Link></Button>}
        description="Use os atalhos para abordar ou revisar o lead sem transformar a lista em relatório passivo."
        title="Leads recentes"
      >
        {summary.recentLeads.length === 0 ? (
          <EmptyState
            action={<Button asChild><Link href="/app/scraper">Começar prospecção</Link></Button>}
            description="Busque leads por cidade e nicho para alimentar o CRM e iniciar a abordagem manual."
            icon={Search}
            title="Nenhum lead salvo ainda"
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {summary.recentLeads.map((lead) => (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4" key={lead.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{lead.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{[lead.category, lead.city].filter(Boolean).join(" · ") || "Sem detalhes"}</p>
                  </div>
                  <StatusBadge tone="red">{leadStatusLabels[lead.status]}</StatusBadge>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">{formatDate(lead.createdAt)}</span>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/app/leads">
                      Revisar
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}
