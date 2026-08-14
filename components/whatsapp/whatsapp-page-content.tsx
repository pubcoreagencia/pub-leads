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
  is_default: boolean;
  metadata: Record<string, unknown>;
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
type CreateFunnelPayload = { funnel: MessageFunnel };
type StatePayload = { events: LeadMessageEvent[]; state: LeadFunnelState };
type ProfilePayload = { fullName: string };
type LeadCapturePeriod = "all" | "today" | "last_7_days" | "last_30_days";
type LeadQueueSort = "newest" | "oldest" | "name_asc" | "niche_asc";
type CopyFormMode = "view" | "create" | "edit";
type DiversifyPayload = {
  diversificationScore?: number;
  error?: string;
  message: string;
};

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

function replaceTemplateValue(text: string, names: string[], value: string) {
  return names.reduce((current, name) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wrappedPattern = new RegExp(`\\{${escapedName}\\}|\\[${escapedName}\\]`, "gi");
    const uppercasePattern = new RegExp(`\\b${escapedName.toUpperCase()}\\b`, "g");

    return current.replace(wrappedPattern, value).replace(uppercasePattern, value);
  }, text);
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

  const rendered = replaceTemplateValue(
    replaceTemplateValue(
      replaceTemplateValue(
        replaceTemplateValue(
          replaceTemplateValue(
            replaceTemplateValue(
              replaceTemplateValue(
                replaceTemplateValue(
                  replaceTemplateValue(
                    replaceTemplateValue(
                      template,
                      ["intro_operador"],
                      getOperatorIntroPhrase(operator, template.length + lead.id.length),
                    ),
                    ["nome", "operador"],
                    operator,
                  ),
                  ["empresa", "lead"],
                  company,
                ),
                ["cidade"],
                city,
              ),
              ["nicho", "copy", "categoria"],
              niche,
            ),
            ["telefone"],
            lead.whatsapp || lead.phone || lead.phone_2 || "",
          ),
          ["site"],
          lead.website || "",
        ),
        ["instagram"],
        instagram,
      ),
      ["plano"],
      "",
    ),
    ["projeto"],
    project,
  )
    .replace(/\{[a-zA-Z_]+\}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  return applyTimeAwareGreeting(applyOperatorIntroPhrase(rendered, operator, template.length + lead.id.length));
}

function getFunnelBaseCopy(funnel: MessageFunnel | null) {
  if (!funnel) {
    return "";
  }

  const storedBaseCopy = funnel.metadata.base_copy;

  if (typeof storedBaseCopy === "string" && storedBaseCopy.trim()) {
    return storedBaseCopy.trim();
  }

  return [...funnel.steps]
    .sort((first, second) => first.step_order - second.step_order)
    .map((step) => step.template.trim())
    .filter(Boolean)
    .join("\n\n");
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
  const [copyFunnelName, setCopyFunnelName] = useState("");
  const [fullBaseCopy, setFullBaseCopy] = useState("");
  const [copyFormMode, setCopyFormMode] = useState<CopyFormMode>("view");
  const [message, setMessage] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [isSavingCopyFunnel, setIsSavingCopyFunnel] = useState(false);
  const [usesMobileWhatsappApp, setUsesMobileWhatsappApp] = useState(false);
  const [onlyEligibleLeads, setOnlyEligibleLeads] = useState(true);
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadCapturePeriod, setLeadCapturePeriod] = useState<LeadCapturePeriod>("all");
  const [leadNicheFilter, setLeadNicheFilter] = useState("all");
  const [leadQueueSort, setLeadQueueSort] = useState<LeadQueueSort>("newest");
  const [variantSeed, setVariantSeed] = useState(1);
  const [mobileTab, setMobileTab] = useState<"queue" | "copies" | "funnel" | "message" | "action">("queue");

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
  const canEditSelectedCopy = Boolean(selectedFunnel);
  const canDeleteSelectedCopy = Boolean(selectedFunnel);
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

  useEffect(() => {
    if (!selectedFunnel || copyFormMode !== "view") {
      return;
    }

    setCopyFunnelName(selectedFunnel.name);
    setFullBaseCopy(getFunnelBaseCopy(selectedFunnel));
  }, [copyFormMode, selectedFunnel]);

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

  const [instances, setInstances] = useState<Array<{ id: string; name: string; status: string; phone: string | null }>>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");

  const loadInstances = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/instances");
      const data = await res.json();
      if (data.instances) {
        setInstances(data.instances);
        const openInst = data.instances.find((i: { status: string }) => i.status === "open");
        if (openInst) setSelectedInstanceId(openInst.id);
        else if (data.instances[0]) setSelectedInstanceId(data.instances[0].id);
      }
    } catch {
      // Silencioso se não houver instâncias
    }
  }, []);

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

    void fetchLeads()
      .then((items) => {
        if (!active) return;
        setLeads(items);
        const pendingItems = items.filter(isPendingApproachLead);
        setLeadId(pendingItems.find((lead) => getLeadPhone(lead))?.id ?? pendingItems[0]?.id ?? "");
      })
      .catch((error) => {
        if (active) {
          toast({
            title: "Aviso na fila de leads",
            description: error instanceof Error ? error.message : "Erro ao carregar leads.",
            variant: "error",
          });
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    void loadFunnels().catch(() => null);
    void loadProfile().catch(() => null);
    void loadInstances().catch(() => null);

    return () => {
      active = false;
    };
  }, [loadFunnels, loadProfile, loadInstances]);

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

  async function handleSendNativeWhatsApp() {
    const phone = getLeadPhone(selectedLead);
    if (!phone || !message) {
      toast({ title: "Dados incompletos", description: "Telefone ou mensagem ausentes.", variant: "error" });
      return;
    }

    setIsActing(true);
    try {
      const res = await fetch("/api/whatsapp/send-native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message, instanceId: selectedInstanceId || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Abrindo no WhatsApp...",
          description: "Servidor em segundo plano ocupado. Abrindo conversa direta.",
          variant: "error",
        });
        await handleOpenWhatsApp();
        return;
      }

      await recordEvent("marked_sent");
      toast({ title: "Mensagem enviada!", description: "Disparo realizado com sucesso.", variant: "success" });
    } catch (err) {
      toast({
        title: "Abrindo no WhatsApp...",
        description: "Redirecionando para envio instantâneo.",
        variant: "error",
      });
      await handleOpenWhatsApp();
    } finally {
      setIsActing(false);
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

  function handleSelectFunnel(nextFunnelId: string) {
    const nextFunnel = funnels.find((funnel) => funnel.id === nextFunnelId);
    const firstStep = nextFunnel?.steps[0] ?? null;

    setCopyFormMode("view");
    setFunnelId(nextFunnelId);
    setActiveStepId(firstStep?.id ?? "");
    setVariantSeed(1);
    setMobileTab("funnel");
  }

  function handleStartCreateCopy() {
    setCopyFormMode("create");
    setCopyFunnelName("");
    setFullBaseCopy("");
    setMobileTab("copies");
  }

  function handleStartEditCopy() {
    if (!selectedFunnel) {
      toast({
        title: "Nenhuma copy selecionada",
        description: "Selecione uma copy antes de editar.",
        variant: "error",
      });
      return;
    }

    setCopyFormMode("edit");
    setCopyFunnelName(selectedFunnel.name);
    setFullBaseCopy(getFunnelBaseCopy(selectedFunnel));
    setMobileTab("copies");
  }

  function handleCancelCopyForm() {
    setCopyFormMode("view");
    setCopyFunnelName(selectedFunnel?.name ?? "");
    setFullBaseCopy(getFunnelBaseCopy(selectedFunnel));
  }

  async function handleCreateCopyFunnel() {
    const name = copyFunnelName.trim();
    const baseCopyValue = fullBaseCopy.trim();

    if (name.length < 2 || baseCopyValue.length < 10) {
      toast({
        title: "Copy incompleta",
        description: "Informe um nome e cole a copy inteira antes de salvar.",
        variant: "error",
      });
      return;
    }

    setIsSavingCopyFunnel(true);

    try {
      const payload = await fetch("/api/message-funnels", {
        body: JSON.stringify({ baseCopy: baseCopyValue, name }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).then((response) => parseJson<CreateFunnelPayload>(response));

      setFunnels((current) => [payload.funnel, ...current.filter((funnel) => funnel.id !== payload.funnel.id)]);
      setFunnelId(payload.funnel.id);
      setActiveStepId(payload.funnel.steps[0]?.id ?? "");
      setCopyFormMode("view");
      setVariantSeed(1);
      setMobileTab("funnel");
      toast({
        title: "Copy registrada",
        description: `${payload.funnel.steps.length} etapas foram criadas no funil.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao registrar copy",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSavingCopyFunnel(false);
    }
  }

  async function handleUpdateCopyFunnel() {
    const name = copyFunnelName.trim();
    const baseCopyValue = fullBaseCopy.trim();

    if (!selectedFunnel) {
      toast({
        title: "Nenhuma copy selecionada",
        description: "Selecione uma copy antes de salvar alteracoes.",
        variant: "error",
      });
      return;
    }

    if (name.length < 2 || baseCopyValue.length < 10) {
      toast({
        title: "Copy incompleta",
        description: "Informe um nome e a copy inteira antes de salvar as alteracoes.",
        variant: "error",
      });
      return;
    }

    setIsSavingCopyFunnel(true);

    try {
      const payload = await fetch("/api/message-funnels", {
        body: JSON.stringify({ baseCopy: baseCopyValue, id: selectedFunnel.id, name }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }).then((response) => parseJson<CreateFunnelPayload>(response));

      setFunnels((current) => current.map((funnel) => (funnel.id === payload.funnel.id ? payload.funnel : funnel)));
      setFunnelId(payload.funnel.id);
      setActiveStepId(payload.funnel.steps[0]?.id ?? "");
      setCopyFormMode("view");
      setVariantSeed(1);
      setMobileTab("funnel");
      toast({
        title: "Copy atualizada",
        description: `${payload.funnel.steps.length} etapas foram atualizadas no funil.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao editar copy",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSavingCopyFunnel(false);
    }
  }

  async function handleDeleteCopyFunnel() {
    if (!selectedFunnel) {
      toast({
        title: "Nenhuma copy selecionada",
        description: "Selecione uma copy antes de apagar.",
        variant: "error",
      });
      return;
    }

    const confirmed = window.confirm(`Apagar a copy "${selectedFunnel.name}"? Essa acao nao pode ser desfeita.`);

    if (!confirmed) {
      return;
    }

    setIsSavingCopyFunnel(true);

    try {
      const payload = await fetch("/api/message-funnels", {
        body: JSON.stringify({ id: selectedFunnel.id }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      }).then((response) => parseJson<FunnelPayload>(response));
      const nextFunnel = payload.funnels[0] ?? null;

      setFunnels(payload.funnels);
      setFunnelId(nextFunnel?.id ?? "");
      setActiveStepId(nextFunnel?.steps[0]?.id ?? "");
      setCopyFormMode("view");
      setCopyFunnelName(nextFunnel?.name ?? "");
      setFullBaseCopy(getFunnelBaseCopy(nextFunnel));
      setVariantSeed(1);
      setMobileTab(nextFunnel ? "funnel" : "copies");
      toast({ title: "Copy apagada", description: "A copy foi removida da lista.", variant: "success" });
    } catch (error) {
      toast({
        title: "Erro ao apagar copy",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSavingCopyFunnel(false);
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
      ) : pendingApproachLeads.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <MessageCircle className="mb-4 h-7 w-7 text-red-600" />
          <h2 className="text-lg font-semibold text-slate-950">Nenhum lead pendente de abordagem</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Salve novos leads na Prospecção ou revise a aba Leads. O lead só sai da abordagem quando avançar para uma etapa acima de Contatado.
          </p>
        </div>
      ) : !selectedFunnel ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Nenhuma copy cadastrada</CardTitle>
            <p className="text-sm leading-6 text-slate-500">
              Crie uma copy para separar automaticamente em etapas e iniciar a abordagem dos leads.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Nome da copy
              <Input
                onChange={(event) => setCopyFunnelName(event.target.value)}
                placeholder="Ex: PUB Start - clinicas"
                value={copyFunnelName}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Copy base inteira
              <textarea
                className="min-h-52 w-full rounded-md border border-input bg-white p-4 text-sm font-normal leading-6 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                onChange={(event) => setFullBaseCopy(event.target.value)}
                placeholder="Cole a sequencia completa aqui. Separe os passos por linhas em branco."
                value={fullBaseCopy}
              />
            </label>
            <Button
              disabled={isSavingCopyFunnel || copyFunnelName.trim().length < 2 || fullBaseCopy.trim().length < 10}
              onClick={handleCreateCopyFunnel}
              type="button"
            >
              {isSavingCopyFunnel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Salvar nova copy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-2 rounded-lg border border-slate-200 bg-white p-1 xl:hidden">
            {[
              ["queue", "Fila"],
              ["copies", "Copys"],
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

          <div className="grid min-w-0 gap-5 lg:grid-cols-[340px_1fr]">
            {/* COLUNA ESQUERDA: FILA DE LEADS FOCADA */}
            <Card className="border-slate-200 bg-white shadow-sm flex flex-col h-[750px]">
              <CardHeader className="p-4 pb-3 border-b border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">Fila de Contato</CardTitle>
                    <p className="text-xs text-slate-500">{approachLeads.length} leads prontos</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 cursor-pointer">
                    <input checked={onlyEligibleLeads} onChange={(event) => setOnlyEligibleLeads(event.target.checked)} type="checkbox" className="rounded text-red-600 focus:ring-red-500" />
                    Só WhatsApp
                  </label>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-8 h-9 text-xs"
                    onChange={(event) => setLeadSearchQuery(event.target.value)}
                    placeholder="Buscar por nome da empresa..."
                    value={leadSearchQuery}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-2 space-y-1.5 overflow-y-auto flex-1">
                {approachLeads.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs leading-5 text-slate-500">
                    Nenhum lead encontrado com os filtros atuais.
                  </div>
                ) : null}
                {approachLeads.map((lead, index) => {
                  const active = lead.id === leadId;
                  const hasPhone = Boolean(getLeadPhone(lead));

                  return (
                    <article
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        active
                          ? "border-red-500 bg-red-50/70 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                      key={lead.id}
                      onClick={() => {
                        setLeadId(lead.id);
                        setMobileTab("message");
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {[lead.city, lead.category].filter(Boolean).join(" · ") || "Lead local"}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${hasPhone ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                          {hasPhone ? "WhatsApp" : "Sem fone"}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </CardContent>
            </Card>

            {/* COLUNA DIREITA: ESPAÇO DE DISPARO RÁPIDO DO OPERADOR */}
            <div className="space-y-4">
              {/* CARD PRINCIPAL DO LEAD ATIVO */}
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="p-5 pb-4 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-bold text-slate-900">{getLeadCompany(selectedLead)}</CardTitle>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {[selectedLead?.city, selectedLead?.category].filter(Boolean).join(" · ") || "Sem contexto"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Telefone: <strong className="text-slate-800">{getLeadPhone(selectedLead) || "Nenhum cadastrado"}</strong>
                      </p>
                    </div>

                    {/* SELEÇÃO RÁPIDA DE CHIP / INSTÂNCIA E ROTEIRO */}
                    <div className="flex flex-wrap items-center gap-3">
                      {instances.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-slate-500">Chip / Atendente:</span>
                          <select
                            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            onChange={(event) => setSelectedInstanceId(event.target.value)}
                            value={selectedInstanceId}
                          >
                            {instances.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                {inst.status === "open" ? "🟢" : "⚪"} {inst.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-500">Roteiro:</span>
                        <select
                          className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          onChange={(event) => handleSelectFunnel(event.target.value)}
                          value={selectedFunnel?.id ?? ""}
                        >
                          {funnels.map((funnel) => (
                            <option key={funnel.id} value={funnel.id}>
                              {funnel.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ETAPAS DO FUNIL EM FORMATO DE PÍLULAS SIMPLES */}
                  <div className="flex flex-wrap items-center gap-2 pt-3">
                    <span className="text-xs font-medium text-slate-400">Etapa:</span>
                    {selectedFunnel?.steps.map((step) => {
                      const active = step.id === activeStep?.id;
                      return (
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            active
                              ? "bg-red-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          key={step.id}
                          onClick={() => setActiveStepId(step.id)}
                          type="button"
                        >
                          Passo {step.step_order}: {step.name}
                        </button>
                      );
                    })}
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* TEXTO DA MENSAGEM */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Mensagem Pronta para Envio
                      </label>
                      <Button
                        disabled={isActing || !selectedLead || baseCopy.trim().length < 10}
                        onClick={handleDiversifyStep}
                        size="sm"
                        type="button"
                        variant="ghost"
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        Gerar Variação IA
                      </Button>
                    </div>

                    <textarea
                      className="min-h-[160px] w-full rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm font-normal text-slate-900 leading-relaxed outline-none focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 transition"
                      onChange={(event) => setMessage(event.target.value)}
                      value={message}
                    />
                  </div>

                  {/* BOTÕES DE AÇÃO PRINCIPAL - CLIQUE ÚNICO */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    <Button
                      className="h-12 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-2"
                      disabled={!message || !getLeadPhone(selectedLead) || isActing}
                      onClick={handleSendNativeWhatsApp}
                      type="button"
                    >
                      {isActing ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
                      Disparar Mensagem Nativa
                    </Button>

                    <Button
                      className="h-12 text-sm font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-2"
                      disabled={!message || !workspaceWaLink || isActing}
                      onClick={handleOpenWhatsApp}
                      type="button"
                      variant="outline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {usesMobileWhatsappApp ? "Abrir App WhatsApp" : "Abrir no WhatsApp Web"}
                    </Button>
                  </div>

                  {/* BARRA DE PROGRESSO DO OPERADOR */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActing}
                        onClick={() => recordEvent("marked_sent")}
                        className="text-xs text-slate-700"
                      >
                        <Send className="mr-1 h-3.5 w-3.5 text-blue-600" />
                        Marcar como Enviado
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActing}
                        onClick={() => recordEvent("marked_replied")}
                        className="text-xs text-slate-700"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                        Marcar que Respondeu
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isActing}
                        onClick={() => recordEvent("skipped")}
                        className="text-xs text-slate-500"
                      >
                        Pular
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleNextLead}
                        className="text-xs bg-slate-900 text-white hover:bg-slate-800"
                      >
                        Próximo Lead
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CANAIS ALTERNATIVOS SIMPLES SE PRECISAR */}
              {(instagramUrl || websiteUrl) ? (
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-xs font-semibold text-slate-500">Outros canais:</span>
                  {instagramUrl ? (
                    <Button size="sm" variant="outline" onClick={() => openAlternative(instagramUrl, "instagram")} className="h-8 text-xs text-pink-700 border-pink-200 bg-pink-50/50 hover:bg-pink-100">
                      <Instagram className="mr-1.5 h-3.5 w-3.5" /> Instagram
                    </Button>
                  ) : null}
                  {websiteUrl ? (
                    <Button size="sm" variant="outline" onClick={() => openAlternative(websiteUrl, "instagram")} className="h-8 text-xs text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100">
                      <Globe2 className="mr-1.5 h-3.5 w-3.5" /> Visitar Site
                    </Button>
                  ) : null}
                </div>
              ) : null}
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
