"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, MessageCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Lead } from "@/schemas/lead";
import { fetchLeads } from "@/services/leads";

type GeneratedMessageResponse = {
  message: string;
  waLink: string | null;
};

export function WhatsAppPageContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState("");
  const [copyBase, setCopyBase] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [message, setMessage] = useState("");
  const [waLink, setWaLink] = useState<string | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variantSeed, setVariantSeed] = useState(1);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === leadId) ?? null,
    [leadId, leads],
  );

  useEffect(() => {
    let active = true;

    fetchLeads()
      .then((items) => {
        if (!active) {
          return;
        }

        setLeads(items);
        setLeadId(items[0]?.id ?? "");
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
  }, [selectedLead]);

  async function handleDiversifyMessage() {
    if (!leadId) {
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
    setMessage("");
    setWaLink(null);

    try {
      const response = await fetch("/api/whatsapp/diversify-message", {
        body: JSON.stringify({
          city,
          copyBase,
          leadId,
          niche,
          variantSeed,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as GeneratedMessageResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel diversificar a mensagem.");
      }

      setMessage(payload.message);
      setWaLink(payload.waLink);
      setVariantSeed((current) => current + 1);
      toast({
        title: "Mensagem diversificada",
        description: "A variação foi salva no historico do lead.",
        variant: "success",
      });
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

  function handleOpenWhatsApp() {
    if (!waLink) {
      toast({
        title: "WhatsApp indisponivel",
        description: "Este lead nao possui telefone ou WhatsApp valido.",
        variant: "error",
      });
      return;
    }

    window.open(waLink, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">WhatsApp</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Diversifique uma copy base e abra o WhatsApp manualmente via link wa.me.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Configurar copy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoadingLeads ? (
              <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                Carregando leads...
              </div>
            ) : leads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                Nenhum lead encontrado. Crie leads manualmente ou salve resultados do buscador antes de gerar mensagens.
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="lead">Lead</Label>
                  <select
                    className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    id="lead"
                    onChange={(event) => {
                      setLeadId(event.target.value);
                      setMessage("");
                      setWaLink(null);
                      setVariantSeed(1);
                    }}
                    value={leadId}
                  >
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.name} {lead.city ? `- ${lead.city}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="copyBase">Copy base</Label>
                  <textarea
                    className="min-h-44 w-full rounded-md border border-input bg-white p-3 text-sm leading-6 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    id="copyBase"
                    onChange={(event) => {
                      setCopyBase(event.target.value);
                      setMessage("");
                      setWaLink(null);
                      setVariantSeed(1);
                    }}
                    placeholder="Ex: Olá, {nome}! Vi que a {empresa} atua em {cidade} no nicho de {nicho}. Posso te mostrar uma ideia rápida por aqui?"
                    value={copyBase}
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Placeholders: {"{nome}"}, {"{empresa}"}, {"{cidade}"}, {"{nicho}"}, {"{telefone}"}, {"{site}"}.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      onChange={(event) => {
                        setCity(event.target.value);
                        setMessage("");
                        setWaLink(null);
                      }}
                      placeholder="Ex: São Paulo"
                      value={city}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="niche">Nicho</Label>
                    <Input
                      id="niche"
                      onChange={(event) => {
                        setNiche(event.target.value);
                        setMessage("");
                        setWaLink(null);
                      }}
                      placeholder="Ex: clínicas odontológicas"
                      value={niche}
                    />
                  </div>
                </div>

                <Button disabled={isGenerating} onClick={handleDiversifyMessage} type="button">
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Diversificar mensagem
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Mensagem diversificada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedLead ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-950">{selectedLead.name}</p>
                <p className="mt-1">
                  {selectedLead.whatsapp || selectedLead.phone
                    ? `Telefone: ${selectedLead.whatsapp || selectedLead.phone}`
                    : "Sem telefone cadastrado"}
                </p>
              </div>
            ) : null}

            {message ? (
              <>
                <textarea
                  className="min-h-56 w-full rounded-md border border-input bg-white p-4 text-sm leading-6 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  onChange={(event) => setMessage(event.target.value)}
                  value={message}
                />
                <Button disabled={!waLink} onClick={handleOpenWhatsApp} type="button">
                  <MessageCircle className="h-4 w-4" />
                  Abrir no WhatsApp
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="mb-4 rounded-lg bg-purple-100 p-3 text-purple-700">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold text-slate-950">Nenhuma mensagem gerada</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Selecione um lead, informe a copy base e diversifique a mensagem para abordagem manual.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
