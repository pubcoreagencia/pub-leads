import { Database, KeyRound, MessageCircle, Settings, ShieldCheck, Zap } from "lucide-react";

import { PageHeader, SectionCard, StatusBadge } from "@/components/ops/page";

function configured(value?: string) {
  return Boolean(value?.trim());
}

export default function ConfigPage() {
  const apifyReady = configured(process.env.APIFY_TOKEN);
  const googleReady = configured(process.env.GOOGLE_PLACES_API_KEY) || configured(process.env.GOOGLE_MAPS_API_KEY);
  const tursoReady = configured(process.env.TURSO_DATABASE_URL) && configured(process.env.TURSO_AUTH_TOKEN);

  const integrations = [
    {
      description: "Auth, profiles, planos, assinaturas e pagamentos.",
      icon: ShieldCheck,
      label: "Supabase",
      status: "Ativo",
      tone: "emerald" as const,
    },
    {
      description: "Leads, sessões de scraping, CNPJ, mensagens e logs operacionais.",
      icon: Database,
      label: "Turso",
      status: tursoReady ? "Configurado" : "Pendente",
      tone: tursoReady ? "emerald" as const : "amber" as const,
    },
    {
      description: "Motores avançados de scraping para contas internas/dev.",
      icon: Zap,
      label: "Apify",
      status: apifyReady ? "Token configurado" : "Sem token",
      tone: apifyReady ? "emerald" as const : "amber" as const,
    },
    {
      description: "Fonte oficial opcional. Google Maps direto continua proibido fora de API oficial.",
      icon: KeyRound,
      label: "Google Places",
      status: googleReady ? "API key configurada" : "Oculto para busca",
      tone: googleReady ? "emerald" as const : "slate" as const,
    },
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        description="Status operacional, integrações e preferências do workspace. Nenhum segredo é exibido nesta tela."
        eyebrow="Workspace"
        title="Configurações"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {integrations.map((item) => (
          <SectionCard className="h-full" key={item.label}>
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-slate-100 p-3 text-slate-700">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-slate-950">{item.label}</h2>
                  <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          description="O PubLeads prepara links e mensagens; o operador confirma e envia fora do sistema."
          title="Abordagem manual"
        >
          <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <MessageCircle className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="font-semibold text-emerald-950">WhatsApp sem automação de disparo</p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                O envio continua manual via janela reutilizável do WhatsApp. Leads com telefone fixo ou inválido não são tratados como WhatsApp.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          description="Fontes técnicas ficam protegidas por permissões server-side."
          title="Área avançada"
        >
          <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4">
            <Settings className="mt-0.5 h-5 w-5 text-red-700" />
            <div>
              <p className="font-semibold text-red-950">Fontes Apify e modo dev</p>
              <p className="mt-1 text-sm leading-6 text-red-800">
                Usuários comuns usam fonte automática. Contas internas/vitalícias podem escolher actors/tasks Apify sem expor token no navegador.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
