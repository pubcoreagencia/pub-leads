import Link from "next/link";
import { ArrowRight, Database, Instagram, KanbanSquare, MessageCircle, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

const workflow = [
  {
    description: "Busque empresas por cidade, nicho e fonte disponível sem expor complexidade técnica para o operador.",
    icon: Search,
    title: "Prospecção guiada",
  },
  {
    description: "Identifique WhatsApp possível, telefone fixo, Instagram, site e sinais úteis antes de salvar.",
    icon: ShieldCheck,
    title: "Qualificação comercial",
  },
  {
    description: "Mova oportunidades entre etapas e mantenha a operação comercial organizada.",
    icon: KanbanSquare,
    title: "Pipeline operacional",
  },
  {
    description: "Diversifique uma copy base e abra o WhatsApp manualmente, sem automação de envio.",
    icon: MessageCircle,
    title: "Abordagem manual",
  },
];

const sources = [
  { icon: Database, label: "CNPJ no Turso" },
  { icon: Instagram, label: "Instagram quando disponível" },
  { icon: Search, label: "Apify para contas avançadas" },
];

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-7">
          <div className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
            PubLeads · prospecção e abordagem B2B
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              Encontre leads bons, qualifique contatos e aborde com ritmo comercial.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              PubLeads une scraping controlado, CNPJ, qualificação de canais, CRM, pipeline e workspace de abordagem manual para transformar busca em oportunidade.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/register">
                Criar conta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full sm:w-auto" variant="outline">
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium">
          <div className="rounded-lg bg-slate-950 p-5 text-white">
            <p className="text-sm font-medium text-red-200">Cockpit comercial</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white/10 p-4">
                <p className="text-xs text-slate-300">Leads com canal</p>
                <p className="mt-2 text-3xl font-semibold">78%</p>
              </div>
              <div className="rounded-lg bg-white/10 p-4">
                <p className="text-xs text-slate-300">Próxima ação</p>
                <p className="mt-2 text-sm font-semibold">Abrir abordagem</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-white p-4 text-slate-950">
              <p className="font-semibold">Clínica Exemplo</p>
              <p className="mt-1 text-sm text-slate-500">Nova Friburgo · clínicas odontológicas</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">WhatsApp possível</span>
                <span className="rounded-full bg-pink-50 px-2 py-1 font-medium text-pink-700">Instagram</span>
                <span className="rounded-full bg-red-50 px-2 py-1 font-medium text-red-700">Pipeline</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workflow.map((item) => (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={item.title}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-700">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="font-semibold text-slate-950">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Fontes e dados preparados para operação real</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Supabase cuida de auth/billing; Turso guarda dados operacionais e volumosos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700" key={source.label}>
                <source.icon className="h-4 w-4 text-red-700" />
                {source.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
