"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, Plus, QrCode, RefreshCw, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ops/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { WhatsappInstance } from "@/src/lib/turso/whatsapp-instances-repository";

export function ConexoesPageContent() {
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  // QR Code Modal
  const [activeQrInstance, setActiveQrInstance] = useState<WhatsappInstance | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  async function loadInstances() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/whatsapp/instances");
      const data = await res.json();
      if (data.instances) {
        setInstances(data.instances);
      }
    } catch {
      toast({ title: "Erro ao carregar", description: "Não foi possível buscar as instâncias.", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInstances();
  }, []);

  async function handleCreateInstance(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !serverUrl || !apiKey) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos.", variant: "error" });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/whatsapp/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, serverUrl, apiKey }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao criar instância.");

      toast({ title: "Instância criada!", description: "Escaneie o QR Code para conectar.", variant: "success" });
      setShowCreateModal(false);
      setName("");
      void loadInstances();

      if (data.qrcode?.base64) {
        setActiveQrInstance(data.instance);
        setQrCodeData(data.qrcode.base64);
      }
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCheckStatus(instance: WhatsappInstance) {
    setIsCheckingStatus(true);
    try {
      const res = await fetch(`/api/whatsapp/instances/${instance.id}/status`);
      const data = await res.json();

      if (data.instance) {
        setInstances((prev) => prev.map((i) => (i.id === instance.id ? data.instance : i)));
        if (data.qrcode?.base64) {
          setActiveQrInstance(data.instance);
          setQrCodeData(data.qrcode.base64);
        } else if (data.instance.status === "open") {
          toast({ title: "Conectado!", description: "WhatsApp conectado com sucesso.", variant: "success" });
          setActiveQrInstance(null);
          setQrCodeData(null);
        }
      }
    } catch {
      toast({ title: "Erro de checagem", description: "Falha ao verificar status.", variant: "error" });
    } finally {
      setIsCheckingStatus(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente desconectar e excluir esta instância?")) return;

    try {
      await fetch(`/api/whatsapp/instances/${id}`, { method: "DELETE" });
      setInstances((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Excluído", description: "Instância removida com sucesso.", variant: "success" });
    } catch {
      toast({ title: "Erro", description: "Falha ao remover instância.", variant: "error" });
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Multi-atendimento nativo"
        title="Conexões de WhatsApp"
        description="Conecte seus números de WhatsApp via QR Code (Evolution API) para disparos automáticos e múltiplos atendentes."
        actions={
          <Button onClick={() => setShowCreateModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Conectar Novo Número
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          Carregando conexões...
        </div>
      ) : instances.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <MessageCircle className="mb-4 h-8 w-8 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-950">Nenhum WhatsApp conectado</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Conecte uma instância da Evolution API para enviar mensagens nativas sem precisar abrir o WhatsApp Web.
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
            Conectar Primeira Conta
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => {
            const isConnected = instance.status === "open";
            return (
              <Card key={instance.id} className="border-slate-200 bg-white shadow-sm flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">{instance.name}</CardTitle>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{instance.instance_name}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isConnected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {isConnected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {isConnected ? "Conectado" : "Aguardando QR"}
                  </span>
                </CardHeader>
                <CardContent className="p-4 pt-3 space-y-3">
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Servidor: <span className="font-mono text-slate-800">{instance.server_url}</span></p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {!isConnected ? (
                      <Button
                        size="sm"
                        onClick={() => void handleCheckStatus(instance)}
                        disabled={isCheckingStatus}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                      >
                        <QrCode className="h-3.5 w-3.5" /> Escanear QR Code
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleCheckStatus(instance)}
                        disabled={isCheckingStatus}
                        className="flex-1 text-xs text-slate-700 gap-1.5"
                      >
                        <RefreshCw className="h-3 w-3" /> Checar Status
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDelete(instance.id)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL CRIAR INSTÂNCIA */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">Conectar Novo WhatsApp</CardTitle>
              <p className="text-xs text-slate-500">Informe os dados da sua Evolution API (VPS ou serviço hospedado).</p>
            </CardHeader>
            <form onSubmit={handleCreateInstance}>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inst-name" className="text-xs font-semibold text-slate-700">Identificação do Atendente / Chip</Label>
                  <Input
                    id="inst-name"
                    required
                    placeholder="Ex: Comercial 01 - Matheus"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inst-url" className="text-xs font-semibold text-slate-700">URL do Servidor Evolution API</Label>
                  <Input
                    id="inst-url"
                    required
                    placeholder="https://sua-evolution-api.com"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inst-key" className="text-xs font-semibold text-slate-700">Global API Key da Evolution</Label>
                  <Input
                    id="inst-key"
                    required
                    type="password"
                    placeholder="Sua chave secreta da API"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} disabled={isCreating}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreating} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                    {isCreating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    Gerar Conexão
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      ) : null}

      {/* MODAL ESCANEAR QR CODE */}
      {activeQrInstance && qrCodeData ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm border-slate-200 bg-white p-6 text-center shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Escanear QR Code</h3>
            <p className="text-xs text-slate-500">
              Abra o WhatsApp no celular &gt; Aparelhos conectados &gt; Conectar aparelho.
            </p>
            <div className="flex justify-center p-2 bg-slate-50 rounded-lg border border-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeData.startsWith("data:") ? qrCodeData : `data:image/png;base64,${qrCodeData}`} alt="QR Code WhatsApp" className="h-56 w-56 rounded" />
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setActiveQrInstance(null); setQrCodeData(null); }} className="w-full">
                Fechar
              </Button>
              <Button
                size="sm"
                onClick={() => void handleCheckStatus(activeQrInstance)}
                disabled={isCheckingStatus}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isCheckingStatus ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Já Escaneei
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
