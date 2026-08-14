"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ops/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { WhatsappInstance } from "@/src/lib/turso/whatsapp-instances-repository";

const QR_POLL_INTERVAL = 3000;
const QR_TIMEOUT = 180_000;

export function ConexoesPageContent() {
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evolutionUnavailable, setEvolutionUnavailable] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Conexão ativa (Modal de pareamento)
  const [activeInstance, setActiveInstance] = useState<WhatsappInstance | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // ─── Polling do status da conexão ──────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const checkStatus = useCallback(
    async (instance: WhatsappInstance): Promise<"open" | "qrcode"> => {
      const res = await fetch(`/api/whatsapp/instances/${instance.id}/status`);
      const data = await res.json() as {
        instance?: WhatsappInstance;
        qrcode?: { base64?: string };
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? "Erro ao checar status.");

      if (data.instance) {
        setInstances((prev) =>
          prev.map((i) => (i.id === instance.id ? data.instance! : i)),
        );
        if (data.qrcode?.base64) {
          setQrCodeData(data.qrcode.base64);
        }
        if (data.instance.status === "open") {
          return "open";
        }
      }
      return "qrcode";
    },
    [],
  );

  const startPolling = useCallback(
    (instance: WhatsappInstance) => {
      stopPolling();
      setIsPolling(true);
      pollStartRef.current = Date.now();

      pollTimerRef.current = setInterval(async () => {
        if (Date.now() - pollStartRef.current > QR_TIMEOUT) {
          stopPolling();
          toast({
            title: "Sessão expirou",
            description: "Clique em 'Conectar' para gerar um novo código.",
            variant: "error",
          });
          return;
        }

        try {
          const status = await checkStatus(instance);
          if (status === "open") {
            stopPolling();
            setActiveInstance(null);
            setQrCodeData(null);
            setPairingCode(null);
            toast({
              title: "✅ WhatsApp Conectado!",
              description: `A instância "${instance.name}" foi conectada com sucesso.`,
              variant: "success",
            });
            // Recarrega lista
            const res = await fetch("/api/whatsapp/instances");
            const d = await res.json() as { instances?: WhatsappInstance[] };
            if (d.instances) setInstances(d.instances);
          }
        } catch {
          // Ignora falhas pontuais de rede no polling
        }
      }, QR_POLL_INTERVAL);
    },
    [checkStatus, stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ─── Carregar instâncias ───────────────────────────────────────────────────

  async function loadInstances() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/whatsapp/instances");
      const data = await res.json() as { instances?: WhatsappInstance[]; error?: string };
      if (data.instances) setInstances(data.instances);
    } catch {
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível buscar as instâncias.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadInstances(); }, []);

  // ─── Criar instância ──────────────────────────────────────────────────────

  async function handleCreateInstance(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe um nome para a instância.", variant: "error" });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/whatsapp/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phoneNumber: phoneNumber.trim() || undefined,
        }),
      });
      const data = await res.json() as {
        instance?: WhatsappInstance;
        qrcode?: { base64?: string };
        pairingCode?: string;
        error?: string;
      };

      if (res.status === 503) {
        setEvolutionUnavailable(true);
        setShowCreateModal(false);
        return;
      }

      if (!res.ok) throw new Error(data.error ?? "Erro ao criar instância.");

      toast({
        title: "Instância pronta!",
        description: data.pairingCode ? "Digite o código no seu celular." : "Escaneie o QR Code.",
        variant: "success",
      });
      setShowCreateModal(false);
      setName("");
      setPhoneNumber("");
      await loadInstances();

      if (data.instance) {
        setActiveInstance(data.instance);
        setQrCodeData(data.qrcode?.base64 ?? null);
        setPairingCode(data.pairingCode ?? null);
        startPolling(data.instance);
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro desconhecido.",
        variant: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  // ─── Abrir pareamento manualmente ─────────────────────────────────────────

  async function handleOpenConnect(instance: WhatsappInstance) {
    setIsCheckingStatus(true);
    try {
      const status = await checkStatus(instance);
      if (status === "open") {
        toast({ title: "Já conectado!", description: "Este WhatsApp já está ativo.", variant: "success" });
        return;
      }
      setActiveInstance(instance);
      startPolling(instance);
    } catch {
      toast({ title: "Erro de status", description: "Não foi possível verificar.", variant: "error" });
    } finally {
      setIsCheckingStatus(false);
    }
  }

  // ─── Excluir instância ────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente desconectar e excluir esta instância?")) return;

    try {
      const res = await fetch(`/api/whatsapp/instances/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Erro ao excluir.");
      }
      setInstances((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Excluído", description: "Instância removida com sucesso.", variant: "success" });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao remover instância.",
        variant: "error",
      });
    }
  }

  function handleCloseModal() {
    stopPolling();
    setActiveInstance(null);
    setQrCodeData(null);
    setPairingCode(null);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Multi-atendimento nativo"
        title="Conexões de WhatsApp"
        description="Conecte seus números de WhatsApp via QR Code ou Código de Pareamento de 8 dígitos para disparos automáticos."
        actions={
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Conectar Novo Número
          </Button>
        }
      />

      {evolutionUnavailable ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Evolution API não configurada</p>
            <p className="mt-0.5 text-xs text-amber-700">
              As variáveis <code className="rounded bg-amber-100 px-1 font-mono">EVOLUTION_API_URL</code> e{" "}
              <code className="rounded bg-amber-100 px-1 font-mono">EVOLUTION_API_KEY</code> precisam ser
              definidas em <strong>Vercel › Project Settings › Environment Variables</strong>.
            </p>
          </div>
        </div>
      ) : null}

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
            Conecte uma conta para disparar mensagens sem precisar abrir o WhatsApp Web manualmente.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
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
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[160px]">
                      {instance.instance_name}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isConnected
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {isConnected ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {isConnected ? "Conectado" : "Aguardando Conexão"}
                  </span>
                </CardHeader>
                <CardContent className="p-4 pt-3 space-y-3">
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {!isConnected ? (
                      <Button
                        size="sm"
                        onClick={() => void handleOpenConnect(instance)}
                        disabled={isCheckingStatus}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                      >
                        {isCheckingStatus ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Smartphone className="h-3.5 w-3.5" />
                        )}
                        Conectar Aparelho
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          setIsCheckingStatus(true);
                          await checkStatus(instance).catch(() => null);
                          setIsCheckingStatus(false);
                        }}
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
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Conectar Novo WhatsApp</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conecte por Código de 8 dígitos ou QR Code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <form onSubmit={(e) => void handleCreateInstance(e)}>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inst-name" className="text-xs font-semibold text-slate-700">
                    Nome do Atendente / Chip
                  </Label>
                  <Input
                    id="inst-name"
                    required
                    autoFocus
                    placeholder="Ex: Comercial 01 · Matheus"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="inst-phone" className="text-xs font-semibold text-slate-700">
                      Número do WhatsApp com DDD (Recomendado)
                    </Label>
                    <span className="text-[11px] text-emerald-600 font-medium">Gera código de 8 dígitos</span>
                  </div>
                  <Input
                    id="inst-phone"
                    placeholder="Ex: 21983419000 (com DDD, sem traço)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500">
                    💡 <strong>Dica:</strong> Se preencher o número, você pode conectar digitando o código de 8 dígitos direto no celular (sem depender de câmera).
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                    Conectar WhatsApp
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      ) : null}

      {/* MODAL DE PAREAMENTO (CÓDIGO DE 8 DÍGITOS OU QR CODE) */}
      {activeInstance ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm border-slate-200 bg-white shadow-2xl">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Conectar WhatsApp</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">{activeInstance.name}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-center">
              {/* SE TEM CÓDIGO DE PAREAMENTO DE 8 DÍGITOS */}
              {pairingCode ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed text-left">
                    1. No celular: <strong>WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho</strong>.<br />
                    2. Toque na opção <strong>&quot;Conectar com número de telefone&quot;</strong> na parte inferior.<br />
                    3. Digite o código abaixo:
                  </p>
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                    <span className="font-mono text-2xl font-extrabold tracking-widest text-emerald-800">
                      {pairingCode.length === 8 ? `${pairingCode.slice(0, 4)} - ${pairingCode.slice(4)}` : pairingCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(pairingCode);
                        toast({ title: "Copiado!", description: "Código copiado para a área de transferência.", variant: "success" });
                      }}
                      className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-100 transition"
                      title="Copiar código"
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : qrCodeData ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Abra o WhatsApp no celular &gt; <strong>Aparelhos conectados</strong> &gt; <strong>Conectar aparelho</strong> e aponte para o QR Code:
                  </p>
                  <div className="flex justify-center rounded-xl bg-slate-50 p-3 border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        qrCodeData.startsWith("data:")
                          ? qrCodeData
                          : `data:image/png;base64,${qrCodeData}`
                      }
                      alt="QR Code WhatsApp"
                      className="h-52 w-52 rounded"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <p className="text-xs text-slate-500">Gerando chave de conexão segura...</p>
                </div>
              )}

              {isPolling ? (
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-medium animate-pulse pt-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Aguardando autenticação do celular...
                </div>
              ) : null}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseModal}
                  className="flex-1 text-xs"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    setIsCheckingStatus(true);
                    try {
                      const status = await checkStatus(activeInstance);
                      if (status === "open") {
                        handleCloseModal();
                        toast({
                          title: "✅ Conectado!",
                          description: "WhatsApp conectado com sucesso.",
                          variant: "success",
                        });
                        void loadInstances();
                      } else {
                        toast({
                          title: "Aguardando confirmação",
                          description: "Confirme a conexão no aplicativo do WhatsApp no celular.",
                          variant: "error",
                        });
                      }
                    } catch {
                      toast({ title: "Erro de status", description: "Tente novamente.", variant: "error" });
                    } finally {
                      setIsCheckingStatus(false);
                    }
                  }}
                  disabled={isCheckingStatus}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                >
                  {isCheckingStatus ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Verificar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
