"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clipboard,
  ExternalLink,
  Globe2,
  Instagram,
  Loader2,
  MessageCircle,
  SkipForward,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Lead } from "@/schemas/lead";
import { fetchLeads } from "@/services/leads";
import { getLeadQualification } from "@/src/lib/lead-qualification/qualifier";
import {
  copyWorkspaceMessage,
  openReusableWorkspaceWindow,
} from "@/src/lib/whatsapp/workspace";
import { createWaLink } from "@/src/lib/whatsapp/wa-link";

type GeneratedMessageResponse = {
  message: string;
  savedMessage: { id: string };
  waLink: string | null;
};

type WorkspaceAction = "contacted" | "copied" | "opened";

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

export function WhatsAppPageContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState("");
  const [copyBase, setCopyBase] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [message, setMessage] = useState("");
  const [messageId, setMessageId] = useState<string | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMarkingContacted, setIsMarkingContacted] = useState(false);
  const [onlyEligibleLeads, setOnlyEligibleLeads] = useState(true);
  const [variantSeed, setVariantSeed] = useState(1);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === leadId) ?? null,
    [leadId, leads],
  );
  const approachLeads = useMemo(
    () => onlyEligibleLeads
      ? leads.filter((lead) => ["confirmed", "possible"].includes(getLeadQualification(lead).whatsapp_status))
      : leads,
    [leads, onlyEligibleLeads],
  );
  const selectedIndex = approachLeads.findIndex((lead) => lead.id === leadId);
  const qualification = selectedLead ? getLeadQualification(selectedLead) : null;
  const instagramUrl = qualification?.instagram_url ?? null;
  const websiteUrl = getWebsiteUrl(selectedLead?.website ?? null);
  const workspaceWaLink = useMemo(() => {
    const phone = getLeadPhone(selectedLead);

    if (!phone || !message.trim()) {
      return null;
    }

    try {
      return createWaLink({ phone, message });
    } catch {
      return null;
    }
  }, [message, selectedLead]);

  useEffect(() => {
    let active = true;

    fetchLeads()
      .then((items) => {
        if (!active) {
          return;
        }

        setLeads(items);
        setLeadId(items.find((lead) => getLeadPhone(lead))?.id ?? items[0]?.id ?? "");
      })
      .catch((error) => {
        toast({
          title: "Erro ao carregar leads",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "error",
        });
      })
      .finally(() => {
        if (active) {
          setIsLoadingLeads(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedLead) {
      return;
    }

    setCity(selectedLead.city ?? "");
    setNiche(selectedLead.category ?? "");
    setMessage("");
    setMessageId(null);
    setVariantSeed(1);
  }, [selectedLead]);

  useEffect(() => {
    if (approachLeads.length > 0 && !approachLeads.some((lead) => lead.id === leadId)) {
      setLeadId(approachLeads[0].id);
    }
  }, [approachLeads, leadId]);

  async function recordWorkspaceAction(action: WorkspaceAction) {
    if (!selectedLead) {
      return;
    }

    try {
      await fetch("/api/whatsapp/workspace-event", {
        body: JSON.stringify({ action, leadId: selectedLead.id, messageId: messageId ?? undefined }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch {
      // Workspace telemetry must not interrupt a manual approach.
    }
  }

  async function handleDiversifyMessage() {
    if (!selectedLead) {
      toast({
        title: "Selecione um lead",
        description: "Escolha um lead antes de diversificar a mensagem.",
        variant: "error",
      });
      return;
    }

    if (!copyBase.trim()) {
      toast({
        title: "Informe a copy base",
        description: "A mensagem diversificada precisa partir de uma copy base.",
        variant: "error",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/whatsapp/diversify-message", {
        body: JSON.stringify({ baseCopy: copyBase, city, leadId: selectedLead.id, niche, variantSeed }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as GeneratedMessageResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível diversificar a mensagem.");
      }

      setMessage(payload.message);
      setMessageId(payload.savedMessage.id);
      setVariantSeed((current) => current + 1);
      toast({ title: "Mensagem diversificada", description: "A variação foi preparada para abordagem manual.", variant: "success" });
    } catch (error) {
      toast({
        title: "Erro ao diversificar mensagem",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopyMessage() {
    if (!message) {
      return;
    }

    try {
      await copyWorkspaceMessage(message);
      void recordWorkspaceAction("copied");
      toast({ title: "Mensagem copiada", description: "Cole e envie manualmente no WhatsApp.", variant: "success" });
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione o texto da mensagem e copie manualmente.", variant: "error" });
    }
  }

  function handleOpenWhatsApp() {
    if (!workspaceWaLink) {
      toast({
        title: "WhatsApp indisponível",
        description: "Este lead não possui telefone ou WhatsApp válido. Use Instagram, site ou pule para o próximo.",
        variant: "error",
      });
      return;
    }

    if (!openReusableWorkspaceWindow(workspaceWaLink, "whatsapp")) {
      toast({ title: "Pop-up bloqueado", description: "Permita a abertura de janelas para usar o WhatsApp manualmente.", variant: "error" });
      return;
    }

    void recordWorkspaceAction("opened");
  }

  function handleOpenAlternative(url: string, channel: "instagram" | "whatsapp") {
    if (!openReusableWorkspaceWindow(url, channel)) {
      toast({ title: "Pop-up bloqueado", description: "Permita a abertura de janelas para continuar.", variant: "error" });
    }
  }

  async function handleMarkContacted() {
    if (!selectedLead) {
      return;
    }

    setIsMarkingContacted(true);

    try {
      const response = await fetch("/api/whatsapp/workspace-event", {
        body: JSON.stringify({ action: "contacted", leadId: selectedLead.id, messageId: messageId ?? undefined }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível atualizar o lead.");
      }

      setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, pipeline_stage: "contacted", status: "contacted" } : lead));
      toast({ title: "Lead marcado como contatado", variant: "success" });
    } catch (error) {
      toast({ title: "Erro ao atualizar lead", description: error instanceof Error ? error.message : "Tente novamente.", variant: "error" });
    } finally {
      setIsMarkingContacted(false);
    }
  }

  function handleNextLead() {
    if (approachLeads.length === 0) {
      return;
    }

    const nextIndex = selectedIndex < 0 || selectedIndex === approachLeads.length - 1 ? 0 : selectedIndex + 1;
    setLeadId(approachLeads[nextIndex].id);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Workspace de abordagem</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Organize cada contato, diversifique a copy e envie manualmente pelo WhatsApp.
          </p>
        </div>
        <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          O envio continua manual.
        </span>
      </div>

      {isLoadingLeads ? (
        <div className="flex min-h-72 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
          Carregando leads...
        </div>
      ) : leads.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <MessageCircle className="mb-4 h-7 w-7 text-purple-600" />
          <h2 className="text-lg font-semibold text-slate-950">Nenhum lead disponível</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Salve leads na Prospecção para iniciar uma abordagem manual.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.25fr_0.85fr]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Fila de leads</CardTitle>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                <span>{approachLeads.length} leads na fila</span>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input checked={onlyEligibleLeads} onChange={(event) => setOnlyEligibleLeads(event.target.checked)} type="checkbox" />
                  Só WhatsApp válido
                </label>
              </div>
            </CardHeader>
            <CardContent className="max-h-[680px] space-y-2 overflow-y-auto">
              {approachLeads.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-500">
                  Nenhum lead com WhatsApp possível ou confirmado nesta fila.
                </p>
              ) : approachLeads.map((lead, index) => {
                const itemQualification = getLeadQualification(lead);
                const active = lead.id === leadId;
                const hasPhone = Boolean(getLeadPhone(lead));

                return (
                  <button
                    className={`w-full rounded-md border p-3 text-left transition ${active ? "border-purple-300 bg-purple-50" : "border-slate-200 hover:border-purple-200 hover:bg-slate-50"}`}
                    key={lead.id}
                    onClick={() => setLeadId(lead.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{lead.name}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{[lead.city, lead.category].filter(Boolean).join(" · ") || "Sem contexto"}</p>
                      </div>
                      <span className="text-xs text-slate-400">{index + 1}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${hasPhone ? "bg-emerald-50 text-emerald-700" : itemQualification.whatsapp_status === "landline" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                        {hasPhone ? "WhatsApp possível" : itemQualification.whatsapp_status === "landline" ? "Telefone fixo" : "Sem WhatsApp"}
                      </span>
                      {itemQualification.instagram_status === "found" ? <span className="rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700">Instagram</span> : null}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Copy e mensagem</CardTitle>
              <p className="text-sm text-slate-500">A copy base permanece a fonte principal da variação.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="copyBase">Copy base</Label>
                <textarea
                  className="min-h-40 w-full rounded-md border border-input bg-white p-3 text-sm leading-6 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  id="copyBase"
                  onChange={(event) => { setCopyBase(event.target.value); setMessage(""); setMessageId(null); }}
                  placeholder="Ex: Olá LEAD, estamos selecionando empresas do nicho COPY em CIDADE. Posso te enviar mais detalhes?"
                  value={copyBase}
                />
                <p className="text-xs leading-5 text-slate-500">Use CIDADE, COPY/NICHO e LEAD/EMPRESA, também entre chaves ou colchetes.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2"><Label htmlFor="city">Cidade</Label><Input id="city" onChange={(event) => setCity(event.target.value)} value={city} /></div>
                <div className="grid gap-2"><Label htmlFor="niche">Nicho</Label><Input id="niche" onChange={(event) => setNiche(event.target.value)} value={niche} /></div>
              </div>

              <Button disabled={isGenerating} onClick={handleDiversifyMessage} type="button">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Diversificar mensagem
              </Button>

              <div className="border-t border-slate-100 pt-5">
                <Label htmlFor="diversifiedMessage">Mensagem diversificada</Label>
                <textarea
                  className="mt-2 min-h-56 w-full rounded-md border border-input bg-white p-4 text-sm leading-6 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  id="diversifiedMessage"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="A mensagem diversificada aparecerá aqui."
                  value={message}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader><CardTitle>Ação manual</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-950">{selectedLead?.name}</p>
                  <p className="mt-1">{getLeadPhone(selectedLead) ?? selectedLead?.phone ?? selectedLead?.phone_2 ?? "Sem telefone cadastrado"}</p>
                  {selectedLead?.city ? <p className="mt-1 text-xs text-slate-500">{selectedLead.city}{selectedLead.state ? `, ${selectedLead.state}` : ""}</p> : null}
                </div>

                <Button className="w-full" disabled={!message || !workspaceWaLink} onClick={handleOpenWhatsApp} type="button">
                  <MessageCircle className="h-4 w-4" />
                  Abrir/atualizar WhatsApp
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button className="w-full" disabled={!message} onClick={handleCopyMessage} type="button" variant="outline">
                  <Clipboard className="h-4 w-4" /> Copiar mensagem
                </Button>
                <Button className="w-full" disabled={isMarkingContacted} onClick={handleMarkContacted} type="button" variant="outline">
                  {isMarkingContacted ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Marcar como contatado
                </Button>
                <Button className="w-full" onClick={handleNextLead} type="button" variant="ghost">
                  <SkipForward className="h-4 w-4" /> Próximo lead <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader><CardTitle>Alternativas de contato</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!getLeadPhone(selectedLead) ? <p className="text-sm leading-6 text-amber-800">Sem WhatsApp válido. Use um canal público alternativo ou pule este lead.</p> : null}
                {instagramUrl ? <Button className="w-full" onClick={() => handleOpenAlternative(instagramUrl, "instagram")} type="button" variant="outline"><Instagram className="h-4 w-4 text-pink-600" /> Abrir Instagram</Button> : null}
                {websiteUrl ? <Button className="w-full" onClick={() => handleOpenAlternative(websiteUrl, "instagram")} type="button" variant="outline"><Globe2 className="h-4 w-4" /> Abrir site</Button> : null}
                {!instagramUrl && !websiteUrl ? <p className="text-sm text-slate-500">Este lead não possui Instagram ou site público disponível.</p> : null}
              </CardContent>
            </Card>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
              O WhatsApp Web não pode ser incorporado com segurança dentro do PubLeads por restrições do próprio serviço. O botão acima reutiliza uma única janela do WhatsApp, sem abrir uma nova guia a cada lead.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
