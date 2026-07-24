"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clipboard,
  ExternalLink,
  Globe2,
  Instagram,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Settings2,
  SkipForward,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { MetricCard, PageHeader, StatusBadge } from "@/components/ops/page";
import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { Lead } from "@/schemas/lead";
import { deleteLeads, fetchLeads } from "@/services/leads";
import { getLeadQualification } from "@/src/lib/lead-qualification/qualifier";
import { applyOperatorIntroPhrase, applyTimeAwareGreeting, getOperatorIntroPhrase } from "@/src/lib/whatsapp/message-funnel";
import { createWhatsAppAppLink, createWhatsAppWebLink, isMobileWhatsappEnvironment } from "@/src/lib/whatsapp/wa-link";
import {
  copyWorkspaceMessage,
  openReusableWorkspaceWindow,
} from "@/src/lib/whatsapp/workspace";

type MessageFunnelStep = {
  id: string;
  name: string;
  objective: string | null;
  step_order: number;
  template: string;
  wait_hint: string | null;
};

type MessageFunnel = {
  id: string;
  name: string;
  description: string | null;
  steps: MessageFunnelStep[];
};

type LeadFunnelState = {
  current_step_id: string | null;
  current_step_order: number;
  funnel_id: string;
  last_message_at: string | null;
  last_reply_at: string | null;
  status: "not_started" | "contacted" | "replied" | "explaining" | "follow_up" | "converted" | "lost" | "paused";
};

type LeadMessageEvent = {
  created_at: string;
  event_type: string;
  id: string;
  message_content: string | null;
  step_order: number | null;
};

type FunnelPayload = { funnels: MessageFunnel[] };
type StatePayload = { events: LeadMessageEvent[]; state: LeadFunnelState };
type DiversifyPayload = { message: string; error?: string; diversificationScore?: number };
type ProfilePayload = { fullName: string };
type LeadCapturePeriod = "all" | "today" | "last_7_days" | "last_30_days";
type LeadQueueSort = "newest" | "oldest" | "name_asc" | "niche_asc";

const funnelStatusLabels: Record<LeadFunnelState["status"], string> = {
  contacted: "Contato feito",
  converted: "Convertido",
  explaining: "Explicando",
  follow_up: "Follow-up",
  lost: "Perdido",
  not_started: "Não iniciado",
  paused: "Pausado",
  replied: "Respondeu",
};

const eventLabels: Record<string, string> = {
  advanced_step: "Avançou etapa",
  copied: "Copiou mensagem",
  marked_replied: "Marcou resposta",
  marked_sent: "Marcou envio",
  note: "Nota",
  opened_whatsapp: "Abriu WhatsApp",
  skipped: "Pulou lead",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getWebsiteUrl(website: string | null) {
  if (!website) {
    return null;
  }

  return website.startsWith("http") ? website : `https://${website}`;
}

function getLeadPhone(lead: Lead | null) {
  if (!lead) {
    return null;
  }

  const qualification = getLeadQualification(lead);
  return qualification.whatsapp_status === "confirmed" || qualification.whatsapp_status === "possible"
    ? lead.whatsapp
    : null;
}

function getLeadCompany(lead: Lead | null) {
  return lead?.company || lead?.business_name || lead?.fantasy_name || lead?.name || "Lead";
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getLeadSearchText(lead: Lead) {
  return normalizeSearchText(
    [
      lead.name,
      lead.company,
      lead.business_name,
      lead.fantasy_name,
      lead.city,
      lead.category,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getLeadCreatedTime(lead: Lead) {
  const timestamp = new Date(lead.created_at).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isLeadInCapturePeriod(lead: Lead, period: LeadCapturePeriod) {
  if (period === "all") {
    return true;
  }

  const createdAt = getLeadCreatedTime(lead);

  if (!createdAt) {
    return false;
  }

  const now = new Date();

  if (period === "today") {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return createdAt >= startOfToday;
  }

  const days = period === "last_7_days" ? 7 : 30;
  const minTime = now.getTime() - days * 24 * 60 * 60 * 1000;

  return createdAt >= minTime;
}

function isPendingApproachLead(lead: Lead) {
  return !["responded", "proposal", "won", "lost"].includes(lead.status);
}

function renderLocalTemplate(template: string, lead: Lead | null, operatorName: string) {
  if (!lead) {
    return "";
  }

  const company = getLeadCompany(lead);
  const city = lead.city || "sua cidade";
  const niche = lead.category || "seu nicho";
  const operator = operatorName || "representante";
  const project = city ? `Projeto ${city}` : "Projeto PUB Start";
  const metadata = lead.metadata ?? {};
  const instagram =
    typeof metadata.instagram_handle === "string"
      ? `@${metadata.instagram_handle.replace(/^@/, "")}`
      : typeof metadata.instagram_url === "string"
        ? metadata.instagram_url
        : "";

  const rendered = template
    .replace(/\{empresa\}|\{lead\}|\bEMPRESA\b|\bLEAD\b/g, company)
    .replace(/\{cidade\}|\bCIDADE\b/g, city)
    .replace(/\{nicho\}|\{copy\}|\bNICHO\b|\bCOPY\b/g, niche)
    .replace(/\{intro_operador\}/g, getOperatorIntroPhrase(operator, template.length + lead.id.length))
    .replace(/\{operador\}/g, operator)
    .replace(/\{telefone\}/g, lead.whatsapp || lead.phone || lead.phone_2 || "")
    .replace(/\{site\}/g, lead.website || "")
    .replace(/\{instagram\}/g, instagram)
    .replace(/\{plano\}/g, "")
    .replace(/\{projeto\}/g, project)
    .replace(/\{[a-zA-Z_]+\}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  return applyTimeAwareGreeting(applyOperatorIntroPhrase(rendered, operator, template.length + lead.id.length));
}

async function parseJson<T>(response: Response) {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Não foi possível concluir a ação.");
  }

  return payload;
}

export function WhatsAppPageContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState("");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [funnels, setFunnels] = useState<MessageFunnel[]>([]);
  const [funnelId, setFunnelId] = useState("");
  const [state, setState] = useState<LeadFunnelState | null>(null);
  const [events, setEvents] = useState<LeadMessageEvent[]>([]);
  const [activeStepId, setActiveStepId] = useState("");
  const [baseCopy, setBaseCopy] = useState("");
  const [message, setMessage] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [usesMobileWhatsappApp, setUsesMobileWhatsappApp] = useState(false);
  const [onlyEligibleLeads, setOnlyEligibleLeads] = useState(true);
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadCapturePeriod, setLeadCapturePeriod] = useState<LeadCapturePeriod>("all");
  const [leadNicheFilter, setLeadNicheFilter] = useState("all");
  const [leadQueueSort, setLeadQueueSort] = useState<LeadQueueSort>("newest");
  const [variantSeed, setVariantSeed] = useState(1);
  const [mobileTab, setMobileTab] = useState<"queue" | "funnel" | "message" | "action">("queue");

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === leadId) ?? null,
    [leadId, leads],
  );
  const selectedFunnel = useMemo(
    () => funnels.find((funnel) => funnel.id === funnelId) ?? funnels[0] ?? null,
    [funnelId, funnels],
  );
  const activeStep = useMemo(() => {
    return selectedFunnel?.steps.find((step) => step.id === activeStepId) ?? selectedFunnel?.steps[0] ?? null;
  }, [activeStepId, selectedFunnel]);
  const pendingApproachLeads = useMemo(() => leads.filter(isPendingApproachLead), [leads]);
  const baseApproachLeads = useMemo(
    () =>
      onlyEligibleLeads
        ? pendingApproachLeads.filter((lead) => ["confirmed", "possible"].includes(getLeadQualification(lead).whatsapp_status))
        : pendingApproachLeads,
    [onlyEligibleLeads, pendingApproachLeads],
  );
  const leadNicheOptions = useMemo(() => {
    const names = new Map<string, string>();

    for (const lead of baseApproachLeads) {
      const category = lead.category?.trim();

      if (category) {
        names.set(normalizeSearchText(category), category);
      }
    }

    return Array.from(names.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [baseApproachLeads]);
  const approachLeads = useMemo(() => {
    const query = normalizeSearchText(leadSearchQuery);
    const filtered = baseApproachLeads.filter((lead) => {
      const matchesSearch = query ? getLeadSearchText(lead).includes(query) : true;
      const matchesNiche =
        leadNicheFilter === "all" ? true : normalizeSearchText(lead.category ?? "") === leadNicheFilter;
      const matchesPeriod = isLeadInCapturePeriod(lead, leadCapturePeriod);

      return matchesSearch && matchesNiche && matchesPeriod;
    });

    return [...filtered].sort((first, second) => {
      if (leadQueueSort === "oldest") {
        return getLeadCreatedTime(first) - getLeadCreatedTime(second);
      }

      if (leadQueueSort === "name_asc") {
        return getLeadCompany(first).localeCompare(getLeadCompany(second), "pt-BR");
      }

      if (leadQueueSort === "niche_asc") {
        return (first.category ?? "").localeCompare(second.category ?? "", "pt-BR");
      }

      return getLeadCreatedTime(second) - getLeadCreatedTime(first);
    });
  }, [baseApproachLeads, leadCapturePeriod, leadNicheFilter, leadQueueSort, leadSearchQuery]);
  const hasLeadQueueFilters =
    leadSearchQuery.trim().length > 0 ||
    leadCapturePeriod !== "all" ||
    leadNicheFilter !== "all" ||
    leadQueueSort !== "newest";

  useEffect(() => {
    if (leadNicheFilter !== "all" && !leadNicheOptions.some((option) => normalizeSearchText(option) === leadNicheFilter)) {
      setLeadNicheFilter("all");
    }
  }, [leadNicheFilter, leadNicheOptions]);
  const selectedIndex = approachLeads.findIndex((lead) => lead.id === leadId);
  const qualification = selectedLead ? getLeadQualification(selectedLead) : null;
  const instagramUrl = qualification?.instagram_url ?? null;
  const websiteUrl = getWebsiteUrl(selectedLead?.website ?? null);
  const whatsappReadyCount = pendingApproachLeads.filter((lead) =>
    ["confirmed", "possible"].includes(getLeadQualification(lead).whatsapp_status),
  ).length;
  const repliedCount = events.some((event) => event.event_type === "marked_replied") ? 1 : 0;
  const workspaceWaLink = useMemo(() => {
    const phone = getLeadPhone(selectedLead);

    if (!phone || !message.trim()) {
      return null;
    }

    try {
      return usesMobileWhatsappApp
        ? createWhatsAppAppLink({ phone, message })
        : createWhatsAppWebLink({ phone, message });
    } catch {
      return null;
    }
  }, [message, selectedLead, usesMobileWhatsappApp]);

  const loadFunnels = useCallback(async () => {
    const payload = await fetch("/api/message-funnels", { cache: "no-store" }).then((response) =>
      parseJson<FunnelPayload>(response),
    );
    setFunnels(payload.funnels);
    setFunnelId((current) => current || payload.funnels[0]?.id || "");
  }, []);

  const loadProfile = useCallback(async () => {
    const payload = await fetch("/api/profile", { cache: "no-store" }).then((response) =>
      parseJson<ProfilePayload>(response),
    );
    setOperatorName(payload.fullName);
  }, []);

  const loadState = useCallback(async (nextLeadId: string) => {
    if (!nextLeadId) {
      return;
    }

    setIsLoadingState(true);

    try {
      const payload = await fetch(`/api/leads/${nextLeadId}/funnel-state`, { cache: "no-store" }).then((response) =>
        parseJson<StatePayload>(response),
      );
      setState(payload.state);
      setEvents(payload.events);
      setFunnelId(payload.state.funnel_id);
      setActiveStepId(payload.state.current_step_id ?? "");
    } catch (error) {
      toast({
        title: "Erro ao carregar funil",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsLoadingState(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([fetchLeads(), loadFunnels(), loadProfile()])
      .then(([items]) => {
        if (!active) {
          return;
        }

        setLeads(items);
        const pendingItems = items.filter(isPendingApproachLead);
        setLeadId(pendingItems.find((lead) => getLeadPhone(lead))?.id ?? pendingItems[0]?.id ?? "");
      })
      .catch((error) => {
        toast({
          title: "Erro ao carregar abordagem",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "error",
        });
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadFunnels, loadProfile]);

  useEffect(() => {
    setUsesMobileWhatsappApp(isMobileWhatsappEnvironment());
  }, []);

  useEffect(() => {
    if (leadId) {
      void loadState(leadId);
    }
  }, [leadId, loadState]);

  useEffect(() => {
    if (approachLeads.length > 0 && !approachLeads.some((lead) => lead.id === leadId)) {
      setLeadId(approachLeads[0].id);
    } else if (approachLeads.length === 0 && leadId) {
      setLeadId("");
    }
  }, [approachLeads, leadId]);

  useEffect(() => {
    if (!activeStep || !selectedLead) {
      setBaseCopy("");
      setMessage("");
      return;
    }

    const renderedTemplate = renderLocalTemplate(activeStep.template, selectedLead, operatorName);
    setBaseCopy(renderedTemplate);
    setMessage(renderedTemplate);
  }, [activeStep, operatorName, selectedLead]);

  async function recordEvent(
    eventType: string,
    options: { advanceTo?: MessageFunnelStep | null; messageContent?: string | null; reloadState?: boolean } = {},
  ) {
    if (!selectedLead || !activeStep || !selectedFunnel) {
      return;
    }

    setIsActing(true);

    try {
      const payload = await fetch(`/api/leads/${selectedLead.id}/message-events`, {
        body: JSON.stringify({
          event_type: eventType,
          funnel_id: selectedFunnel.id,
          message_content: options.messageContent ?? message,
          step_id: options.advanceTo?.id ?? activeStep.id,
          step_order: options.advanceTo?.step_order ?? activeStep.step_order,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).then((response) => parseJson<{ event: LeadMessageEvent }>(response));
      if (options.reloadState === false) {
        setEvents((current) => (payload.event ? [payload.event, ...current] : current));
        return;
      }
      await loadState(selectedLead.id);
    } catch (error) {
      toast({
        title: "Erro ao registrar ação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleCopyMessage() {
    if (!message) {
      return;
    }

    try {
      await copyWorkspaceMessage(message);
      await recordEvent("copied", { reloadState: false });
      toast({ title: "Mensagem copiada", description: "Cole e envie manualmente no WhatsApp.", variant: "success" });
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione o texto e copie manualmente.", variant: "error" });
    }
  }

  async function handleOpenWhatsApp() {
    if (!workspaceWaLink) {
      toast({
        title: "WhatsApp indisponível",
        description: "Este lead não possui WhatsApp válido. Use Instagram, site ou pule para o próximo.",
        variant: "error",
      });
      return;
    }

    if (!openReusableWorkspaceWindow(workspaceWaLink, "whatsapp")) {
      toast({ title: "Pop-up bloqueado", description: "Permita abertura de janelas para continuar.", variant: "error" });
      return;
    }

    await recordEvent("opened_whatsapp");
  }

  async function handleDiversifyStep() {
    if (!selectedLead) {
      return;
    }

    if (baseCopy.trim().length < 10) {
      toast({
        title: "Copy base muito curta",
        description: "Cole uma copy base com mais contexto antes de diversificar.",
        variant: "error",
      });
      return;
    }

    setIsActing(true);

    try {
      const payload = await fetch("/api/whatsapp/diversify-message", {
        body: JSON.stringify({
          baseCopy,
          city: selectedLead.city ?? "",
          leadId: selectedLead.id,
          mode: "same_strength",
          niche: selectedLead.category ?? "",
          variantSeed,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).then((response) => parseJson<DiversifyPayload>(response));
      setMessage(payload.message);
      setVariantSeed((current) => current + 1);
    } catch (error) {
      toast({
        title: "Erro ao variar mensagem",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleAdvanceStep() {
    if (!selectedFunnel || !activeStep || !selectedLead) {
      return;
    }

    const nextStep =
      selectedFunnel.steps.find((step) => step.step_order === activeStep.step_order + 1) ?? activeStep;
    setActiveStepId(nextStep.id);
    setMobileTab("message");
    await recordEvent("advanced_step", { advanceTo: nextStep });
  }

  function handleNextLead() {
    if (approachLeads.length === 0) {
      return;
    }

    const nextIndex = selectedIndex < 0 || selectedIndex === approachLeads.length - 1 ? 0 : selectedIndex + 1;
    setLeadId(approachLeads[nextIndex].id);
    setMobileTab("funnel");
  }

  async function handleDeleteLeadFromQueue(lead: Lead) {
    const confirmed = window.confirm(`Excluir ${getLeadCompany(lead)} da base de leads? Essa ação não pode ser desfeita.`);

    if (!confirmed) {
      return;
    }

    setIsDeletingLead(true);

    try {
      await deleteLeads([lead.id]);
      setLeads((current) => current.filter((item) => item.id !== lead.id));

      if (lead.id === leadId) {
        setState(null);
        setEvents([]);
        setLeadId("");
      }

      toast({ title: "Lead excluído", description: "O lead saiu da fila de abordagem.", variant: "success" });
    } catch (error) {
      toast({
        title: "Erro ao excluir lead",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsDeletingLead(false);
    }
  }

  function handleLeadSettingsChanged() {
    void fetchLeads()
      .then((items) => {
        setLeads(items);
      })
      .catch((error) => {
        toast({
          title: "Erro ao atualizar fila",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "error",
        });
      });
  }

  function openLeadSettings(lead: Lead) {
    setEditingLead(lead);
  }

  function openAlternative(url: string, channel: "instagram" | "whatsapp") {
    if (!openReusableWorkspaceWindow(url, channel)) {
      toast({ title: "Pop-up bloqueado", description: "Permita abertura de janelas para continuar.", variant: "error" });
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        actions={<StatusBadge tone="amber">Workspace WhatsApp Web</StatusBadge>}
        description="Siga um roteiro comercial por etapas, registre ações e avance a conversa sem automatizar envio."
        eyebrow="Funil de mensagens"
        title="Abordagem"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard accent="red" icon={Users} label="Leads na fila" value={pendingApproachLeads.length} />
        <MetricCard accent="emerald" icon={MessageCircle} label="WhatsApp possível" value={whatsappReadyCount} />
        <MetricCard accent="blue" icon={CheckCircle2} label="Respostas no lead" value={repliedCount} />
      </div>

      {isLoading ? (
        <div className="flex min-h-72 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-red-600" />
          Carregando funil de abordagem...
        </div>
      ) : pendingApproachLeads.length === 0 || !selectedFunnel ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <MessageCircle className="mb-4 h-7 w-7 text-red-600" />
          <h2 className="text-lg font-semibold text-slate-950">Nenhum lead pendente de abordagem</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Salve novos leads na Prospecção ou revise a aba Leads. O lead só sai da abordagem quando avançar para uma etapa acima de Contatado.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 rounded-lg border border-slate-200 bg-white p-1 xl:hidden">
            {[
              ["queue", "Fila"],
              ["funnel", "Funil"],
              ["message", "Mensagem"],
              ["action", "Ação"],
            ].map(([id, label]) => (
              <button
                className={`rounded-md px-2 py-2 text-xs font-semibold transition ${
                  mobileTab === id ? "bg-red-50 text-red-700" : "text-slate-500"
                }`}
                key={id}
                onClick={() => setMobileTab(id as typeof mobileTab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(360px,0.95fr)_minmax(500px,1.25fr)]">
            <Card className={`${mobileTab === "queue" ? "block" : "hidden"} border-slate-200 bg-white shadow-sm xl:block`}>
              <CardHeader>
                <CardTitle>Fila de leads</CardTitle>
                <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                  <span>
                    {hasLeadQueueFilters
                      ? `${approachLeads.length} de ${baseApproachLeads.length} leads`
                      : `${approachLeads.length} leads na fila`}
                  </span>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input checked={onlyEligibleLeads} onChange={(event) => setOnlyEligibleLeads(event.target.checked)} type="checkbox" />
                    Só WhatsApp
                  </label>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    onChange={(event) => setLeadSearchQuery(event.target.value)}
                    placeholder="Pesquisar lead por nome"
                    value={leadSearchQuery}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    onChange={(event) => setLeadCapturePeriod(event.target.value as LeadCapturePeriod)}
                    value={leadCapturePeriod}
                  >
                    <option value="all">Todas as datas</option>
                    <option value="today">Capturados hoje</option>
                    <option value="last_7_days">Últimos 7 dias</option>
                    <option value="last_30_days">Últimos 30 dias</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    onChange={(event) => setLeadNicheFilter(event.target.value)}
                    value={leadNicheFilter}
                  >
                    <option value="all">Todos os nichos</option>
                    {leadNicheOptions.map((category) => (
                      <option key={category} value={normalizeSearchText(category)}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    onChange={(event) => setLeadQueueSort(event.target.value as LeadQueueSort)}
                    value={leadQueueSort}
                  >
                    <option value="newest">Mais recentes primeiro</option>
                    <option value="oldest">Primeiros capturados</option>
                    <option value="name_asc">Nome A-Z</option>
                    <option value="niche_asc">Nicho A-Z</option>
                  </select>
                </div>
                {hasLeadQueueFilters ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setLeadSearchQuery("");
                      setLeadCapturePeriod("all");
                      setLeadNicheFilter("all");
                      setLeadQueueSort("newest");
                    }}
                    type="button"
                    variant="outline"
                  >
                    Limpar filtros
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="max-h-[680px] space-y-2 overflow-y-auto">
                {approachLeads.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                    Nenhum lead encontrado para essa busca.
                  </div>
                ) : null}
                {approachLeads.map((lead, index) => {
                  const active = lead.id === leadId;
                  const hasPhone = Boolean(getLeadPhone(lead));

                  return (
                    <article
                      className={`cursor-pointer rounded-md border p-3 transition ${
                        active ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-red-200 hover:bg-slate-50"
                      }`}
                      key={lead.id}
                      onClick={() => {
                        setLeadId(lead.id);
                        setMobileTab("funnel");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setLeadId(lead.id);
                          setMobileTab("funnel");
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{lead.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {[lead.city, lead.category].filter(Boolean).join(" · ") || "Sem contexto"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">Capturado em {formatDate(lead.created_at)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs text-slate-400">{index + 1}</span>
                          <button
                            aria-label={`Abrir configurações de ${lead.name}`}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              openLeadSettings(lead);
                            }}
                            type="button"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                          <button
                            aria-label={`Excluir ${lead.name}`}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-100 hover:text-red-700"
                            disabled={isDeletingLead}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteLeadFromQueue(lead);
                            }}
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${hasPhone ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {hasPhone ? "WhatsApp possível" : "Sem WhatsApp"}
                        </span>
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          {active && state ? funnelStatusLabels[state.status] : "Funil"}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </CardContent>
            </Card>

            <div className={`${mobileTab === "queue" ? "hidden" : "block"} grid min-w-0 gap-5 xl:grid xl:grid-cols-[minmax(230px,0.58fr)_minmax(420px,1fr)] 2xl:block`}>
            <Card className={`${mobileTab === "funnel" ? "block" : "hidden"} border-slate-200 bg-white shadow-sm xl:block`}>
              <CardHeader>
                <CardTitle>{selectedFunnel.name}</CardTitle>
                <p className="text-sm leading-6 text-slate-500">{selectedFunnel.description}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoadingState ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                    Carregando estado...
                  </div>
                ) : null}
                {selectedFunnel.steps.map((step) => {
                  const active = step.id === activeStep?.id;
                  const completed = state ? step.step_order < state.current_step_order : false;

                  return (
                    <button
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        active ? "border-red-300 bg-red-50" : completed ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                      key={step.id}
                      onClick={() => {
                        setActiveStepId(step.id);
                        setMobileTab("message");
                      }}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {step.step_order}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950">{step.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{step.objective}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <div className={`${mobileTab === "message" || mobileTab === "action" ? "block" : "hidden"} min-w-0 space-y-5 xl:block`}>
              <Card className={`${mobileTab === "message" ? "block" : "hidden"} border-slate-200 bg-white shadow-sm xl:block`}>
                <CardHeader>
                  <CardTitle>Copy para WhatsApp</CardTitle>
                  <p className="text-sm leading-6 text-slate-500">
                    {activeStep ? `Base do passo ${activeStep.step_order} — ${activeStep.name}` : "Selecione um passo do funil."}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="font-semibold text-slate-950">{getLeadCompany(selectedLead)}</p>
                    <p className="mt-1">
                      {[selectedLead?.city, selectedLead?.category].filter(Boolean).join(" · ") || "Sem contexto"}
                    </p>
                    <p className="mt-1 text-xs">{state ? funnelStatusLabels[state.status] : "Não iniciado"}</p>
                  </div>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Copy base
                    <textarea
                      className="min-h-40 w-full rounded-md border border-input bg-white p-4 text-sm font-normal leading-6 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      onChange={(event) => {
                        setBaseCopy(event.target.value);
                        setMessage(event.target.value);
                      }}
                      placeholder="Cole aqui a copy que deve ser diversificada"
                      value={baseCopy}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Mensagem diversificada
                    <textarea
                      className="min-h-44 w-full rounded-md border border-input bg-white p-4 text-sm font-normal leading-6 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 xl:min-h-52"
                      onChange={(event) => setMessage(event.target.value)}
                      value={message}
                    />
                  </label>
                  {activeStep?.wait_hint ? (
                    <p className="text-xs leading-5 text-slate-500">{activeStep.wait_hint}</p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button disabled={isActing || !selectedLead || baseCopy.trim().length < 10} onClick={handleDiversifyStep} type="button" variant="outline">
                      <Sparkles className="h-4 w-4" />
                      Diversificar copy
                    </Button>
                    <Button disabled={!message || isActing} onClick={handleCopyMessage} type="button">
                      <Clipboard className="h-4 w-4" />
                      Copiar mensagem
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${mobileTab === "action" ? "block" : "hidden"} border-slate-200 bg-white shadow-sm xl:block`}>
                <CardHeader>
                  <CardTitle>Ação manual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" disabled={!message || !workspaceWaLink || isActing} onClick={handleOpenWhatsApp} type="button">
                    <MessageCircle className="h-4 w-4" />
                    {usesMobileWhatsappApp ? "Abrir no app WhatsApp" : "Enviar para WhatsApp Web"}
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <p className="text-xs leading-5 text-slate-500">
                    {usesMobileWhatsappApp ? (
                      "No celular, a mensagem abre direto no app do WhatsApp para envio manual."
                    ) : (
                      "A primeira abertura cria o workspace do WhatsApp Web. As próximas mensagens reutilizam a mesma aba."
                    )}
                  </p>
                  <Button className="w-full" disabled={isActing} onClick={() => recordEvent("marked_sent")} type="button" variant="outline">
                    <Send className="h-4 w-4" />
                    Marcar como enviado
                  </Button>
                  <Button className="w-full" disabled={isActing} onClick={() => recordEvent("marked_replied")} type="button" variant="outline">
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar que respondeu
                  </Button>
                  <Button className="w-full" disabled={isActing} onClick={handleAdvanceStep} type="button" variant="outline">
                    Avançar etapa
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button className="w-full" disabled={isActing} onClick={() => recordEvent("skipped")} type="button" variant="ghost">
                    Pular lead
                  </Button>
                  <Button className="w-full" onClick={handleNextLead} type="button" variant="ghost">
                    <SkipForward className="h-4 w-4" />
                    Próximo lead
                  </Button>

                  {!getLeadPhone(selectedLead) ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                      Lead sem WhatsApp válido. Use um canal alternativo ou pause a abordagem.
                    </div>
                  ) : null}
                  {instagramUrl ? <Button className="w-full" onClick={() => openAlternative(instagramUrl, "instagram")} type="button" variant="outline"><Instagram className="h-4 w-4 text-pink-600" /> Abrir Instagram</Button> : null}
                  {websiteUrl ? <Button className="w-full" onClick={() => openAlternative(websiteUrl, "instagram")} type="button" variant="outline"><Globe2 className="h-4 w-4" /> Abrir site</Button> : null}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Histórico da abordagem</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {events.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                      Nenhuma ação registrada neste lead ainda.
                    </p>
                  ) : (
                    events.slice(0, 8).map((event) => (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={event.id}>
                        <p className="text-sm font-semibold text-slate-950">
                          {eventLabels[event.event_type] ?? event.event_type}
                          {event.step_order ? ` · passo ${event.step_order}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(event.created_at)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
            </div>
          </div>

          <div className="fixed inset-x-3 bottom-20 z-30 grid grid-cols-4 gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)] xl:hidden">
            <Button disabled={!message || isActing} onClick={handleCopyMessage} size="sm" type="button" variant="outline">
              <Clipboard className="h-4 w-4" />
              Copiar
            </Button>
            <Button disabled={!message || !workspaceWaLink || isActing} onClick={handleOpenWhatsApp} size="sm" type="button">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button disabled={isActing} onClick={() => recordEvent("marked_sent")} size="sm" type="button" variant="outline">
              Enviado
            </Button>
            <Button disabled={isActing} onClick={handleAdvanceStep} size="sm" type="button" variant="outline">
              Próximo
            </Button>
          </div>
        </>
      )}
      <LeadDetailModal
        lead={editingLead}
        onChanged={handleLeadSettingsChanged}
        onClose={() => setEditingLead(null)}
        open={Boolean(editingLead)}
      />
    </section>
  );
}
