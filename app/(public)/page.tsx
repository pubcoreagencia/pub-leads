import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle, Flame, KanbanSquare, MessageCircle, Search, ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Search,
    title: "Prospecção B2B Guiada",
    description: "Extraia leads de qualquer nicho e cidade brasileira via Apify Google Maps com dados atualizados.",
  },
  {
    icon: ShieldCheck,
    title: "Enriquecimento de Contato",
    description: "Robô automático que varre o site do lead descobrindo WhatsApp, Instagram e Email em segundos.",
  },
  {
    icon: MessageCircle,
    title: "Abordagem WhatsApp Nativa",
    description: "Dispare mensagens personalizadas direto pelos seus números e chips com 1 clique.",
  },
  {
    icon: KanbanSquare,
    title: "CRM & Funil de Vendas",
    description: "Acompanhe cada lead da prospecção até o fechamento com pipeline visual e controle total.",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden pb-20">
      {/* HERO SECTION */}
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 lg:pt-20">
        <div className="flex flex-col items-center text-center space-y-8">
          {/* BADGE DE NOVIDADE */}
          <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50/80 px-4 py-1.5 text-xs font-bold text-red-700 shadow-sm backdrop-blur">
            <Flame className="h-4 w-4 text-red-600 animate-pulse" />
            <span>Novo Motor de Prospecção & WhatsApp Multi-Atendentes</span>
          </div>

          {/* LOGO HERO ANIMADA */}
          <div className="relative group my-2">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 opacity-20 blur-xl group-hover:opacity-35 transition duration-700" />
            <div className="relative flex items-center justify-center p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xl shadow-red-500/10">
              <Image
                alt="PubLeads — Prospecção e Vendas B2B"
                className="h-28 sm:h-36 w-auto object-contain transition-transform duration-500 group-hover:scale-105"
                height={160}
                priority
                src="/brand/publeads-logo.png"
                width={360}
              />
            </div>
          </div>

          {/* HEADLINE PRINCIPAL */}
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl leading-[1.15]">
              Prospecção que Encontra o <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-500">WhatsApp Real</span> e Gera Vendas.
            </h1>
            <p className="text-lg text-slate-600 sm:text-xl max-w-2xl mx-auto font-normal leading-relaxed">
              O ecossistema completo para agências, corretores, consultores e equipes comerciais encontrarem clientes qualificados e abordarem com alta conversão.
            </p>
          </div>

          {/* CTA BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-2">
            <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 text-base font-bold bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/25 gap-2">
              <Link href="/register">
                Começar a Prospectar Agora
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base font-semibold border-slate-300 text-slate-700 hover:bg-slate-100">
              <Link href="/login">Já sou cliente</Link>
            </Button>
          </div>

          {/* SOCIAL PROOF PEQUENO */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-emerald-600" /> Sem taxas por lead</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-emerald-600" /> Conexão WhatsApp Multi-números</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-emerald-600" /> Variação de Mensagens com IA</span>
          </div>
        </div>
      </section>

      {/* CARDS DE DESTAQUES */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Tudo o que sua máquina de vendas precisa</h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">Do primeiro contato até o fechamento do contrato, tudo em uma única plataforma.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((item) => (
            <div
              key={item.title}
              className="group relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-xl hover:border-red-200 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors duration-300">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BANNER FINAL DE CONVERSÃO */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#180204_0%,#350409_50%,#09090b_100%)] p-8 sm:p-14 text-center text-white shadow-2xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Pronto para transformar prospecção em prosperidade?
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Crie sua conta agora e tenha acesso imediato à plataforma oficial da PubLeads.
            </p>
            <Button asChild size="lg" className="h-14 px-10 text-base font-bold bg-white text-slate-950 hover:bg-slate-100 shadow-xl shadow-white/10">
              <Link href="/register">Criar Conta Gratuita</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
