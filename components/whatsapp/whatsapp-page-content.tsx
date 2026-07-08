"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, MessageCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageObjectives, messageTones, type MessageObjective, type MessageTone } from "@/config/whatsapp";
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
  const [tone, setTone] = useState<MessageTone>("consultivo");
  const [objective, setObjective] = useState<MessageObjective>("apresentar_servico");
  const [userCompany, setUserCompany] = useState("");
  const [message, setMessage] = useState("");
  const [waLink, setWaLink] = useState<string | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

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

  async function handleGenerateMessage() {
    if (!leadId) {
      toast({
        title: "Selecione um lead",
        description: "Escolha um lead antes de gerar a mensagem.",
        variant: "error",
      });
      return;
    }

    setIsGenerating(true);
    setMessage("");
    setWaLink(null);

    try {
      const response = await fetch("/api/ai/lead-message", {
        body: JSON.stringify({
          leadId,
          objective,
          tone,
          userCompany,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as GeneratedMessageResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel gerar a mensagem.");
      }

      setMessage(payload.message);
      setWaLink(payload.waLink);
      toast({
        title: "Mensagem gerada",
        description: "A mensagem foi salva no historico do lead.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar mensagem",
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
          Gere mensagens com IA e abra o WhatsApp manualmente via link wa.me.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Configurar mensagem</CardTitle>
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
                  <Label htmlFor="userCompany">Sua empresa</Label>
                  <Input
                    id="userCompany"
                    onChange={(event) => setUserCompany(event.target.value)}
                    placeholder="Ex: PubLeads"
                    value={userCompany}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tone">Tom</Label>
                  <select
                    className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    id="tone"
                    onChange={(event) => setTone(event.target.value as MessageTone)}
                    value={tone}
                  >
                    {messageTones.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="objective">Objetivo</Label>
                  <select
                    className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    id="objective"
                    onChange={(event) => setObjective(event.target.value as MessageObjective)}
                    value={objective}
                  >
                    {messageObjectives.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button disabled={isGenerating} onClick={handleGenerateMessage} type="button">
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar mensagem
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Mensagem pronta</CardTitle>
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
                  Selecione um lead, escolha tom e objetivo, depois gere uma mensagem para abordagem manual.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
