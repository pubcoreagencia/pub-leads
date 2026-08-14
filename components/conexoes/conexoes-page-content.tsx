"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
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
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

// Intervalo do polling de QR Code (ms)
const QR_POLL_INTERVAL = 3000;
// Timeout máximo de espera pelo scan (ms) — 3 minutos
const QR_TIMEOUT = 180_000;

const WARMUP_TASKS = [
  { day: 1, title: "Dia 1 - Reconhecimento", tasks: [
    { id: "d1_t1", label: "Envie 3 mensagens manuais curtas para familiares/amigos" },
    { id: "d1_t2", label: "Receba e responda a 2 mensagens" },
    { id: "d1_t3", label: "Aguarde 24h sem usar o sistema automático" },
  ]},
  { day: 2, title: "Dia 2 - Aquecimento", tasks: [
    { id: "d2_t1", label: "Participe de 1 grupo no WhatsApp" },
    { id: "d2_t2", label: "Envie 1 áudio curto para um conhecido" },
    { id: "d2_t3", label: "Troque cerca de 10 mensagens manuais" },
  ]},
  { day: 3, title: "Dia 3 - Validação", tasks: [
    { id: "d3_t1", label: "Poste 1 foto no Status do WhatsApp" },
    { id: "d3_t2", label: "Converse com 5 pessoas diferentes" },
    { id: "d3_t3", label: "Realize 1 disparo teste para seu próprio número" },
  ]},
];

export function ConexoesPageContent() {
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evolutionUnavailable, setEvolutionUnavailable] = useState(false);

  // Form state
  const [name, setName] = useState("");

  // QR Code state
  const [activeQrInstance, setActiveQrInstance] = useState<WhatsappInstance | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // Warmup state
  const [warmupInstance, setWarmupInstance] = useState<WhatsappInstance | null>(null);
  const [warmupProgress, setWarmupProgress] = useState<Record<string, boolean>>({});
  const [isSavingWarmup, setIsSavingWarmup] = useState(false);

  // ─── Polling do status da conexão ──────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const checkStatus = useCallback(
    async (instance: WhatsappInstance, refresh = false): Promise<"open" | "qrcode"> => {
      const url = `/api/whatsapp/instances/${instance.id}/status${refresh ? "?refresh=true" : ""}`;
      const res = await fetch(url);
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
            title: "QR Code expirou",
            description: "Clique em 'Escanear QR Code' para gerar um novo código.",
            variant: "error",
          });
          return;
        }

        try {
          const status = await checkStatus(instance, false);
          if (status === "open") {
            stopPolling();
            setActiveQrInstance(null);
            setQrCodeData(null);
            toast({
              title: "✅ WhatsApp Conectado!",
              description: `A instância "${instance.name}" foi conectada com sucesso.`,
              variant: "success",
            });
            // Recarrega lista completa
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
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json() as {
        instance?: WhatsappInstance;
        qrcode?: { base64?: string };
        error?: string;
      };

      if (res.status === 503) {
        setEvolutionUnavailable(true);
        setShowCreateModal(false);
        return;
      }

      if (!res.ok) throw new Error(data.error ?? "Erro ao criar instância.");

      toast({
        title: "Instância criada!",
        description: "Escaneie o QR Code para conectar seu WhatsApp.",
        variant: "success",
      });
      setShowCreateModal(false);
      setName("");
      await loadInstances();

      if (data.instance && data.qrcode?.base64) {
        setActiveQrInstance(data.instance);
        setQrCodeData(data.qrcode.base64);
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

  // ─── Abrir QR Code manualmente ────────────────────────────────────────────

  async function handleOpenQr(instance: WhatsappInstance) {
    setIsCheckingStatus(true);
    try {
      const status = await checkStatus(instance, true);
      if (status === "open") {
        toast({ title: "Já conectado!", description: "Este WhatsApp já está ativo.", variant: "success" });
        return;
      }
      setActiveQrInstance(instance);
      startPolling(instance);
    } catch {
      toast({ title: "Erro de status", description: "Não foi possível obter o QR Code.", variant: "error" });
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

  function handleCloseQr() {
    stopPolling();
    setActiveQrInstance(null);
    setQrCodeData(null);
  }

  // ─── Maturador (Warm-up) ──────────────────────────────────────────────────

  function handleOpenWarmup(instance: WhatsappInstance) {
    let progress = {};
    try {
      if (instance.warmup_progress_json) {
        progress = JSON.parse(instance.warmup_progress_json);
      }
    } catch {
      // ignore
    }
    setWarmupProgress(progress);
    setWarmupInstance(instance);
  }

  async function handleSaveWarmup() {
    if (!warmupInstance) return;
    setIsSavingWarmup(true);
    try {
      const isCompleted = WARMUP_TASKS.flatMap((d) => d.tasks).every((t) => warmupProgress[t.id]);
      const res = await fetch(`/api/whatsapp/instances/${warmupInstance.id}/warmup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warmup_completed: isCompleted,
          warmup_progress_json: warmupProgress,
        }),
      });

      if (!res.ok) throw new Error("Erro ao salvar progresso.");

      setInstances((prev) =>
        prev.map((i) =>
          i.id === warmupInstance.id
            ? { ...i, warmup_completed: isCompleted, warmup_progress_json: JSON.stringify(warmupProgress) }
            : i
        ),
      );
      toast({ title: "Progresso salvo", description: "O checklist de maturação foi atualizado.", variant: "success" });
      setWarmupInstance(null);
    } catch {
      toast({ title: "Erro", description: "Falha ao salvar maturação.", variant: "error" });
    } finally {
      setIsSavingWarmup(false);
    }
  }

  function getWarmupHealth(instance: WhatsappInstance) {
    if (instance.warmup_completed) return { text: "Maturação Concluída", color: "text-emerald-700 bg-emerald-100", icon: ShieldCheck };
    
    const createdAt = new Date(instance.created_at);
    const diffTime = Math.abs(Date.now() - createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return { 
      text: `Maturação: Dia ${diffDays}`, 
      color: diffDays >= 3 ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100", 
      icon: diffDays >= 3 ? Shield : ShieldAlert 
    };
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Multi-atendimento nativo"
        title="Conexões de WhatsApp"
        description="Conecte seus números de WhatsApp via QR Code para disparos automáticos e múltiplos atendentes."
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
            Conecte uma instância para enviar mensagens nativas sem precisar abrir o WhatsApp Web.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            Conectar Primeira Conta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
          {instances.map((instance) => {
            const isConnected = instance.status === "open";
            return (
              <Card key={instance.id} className="border-slate-200 bg-white shadow-sm flex flex-col justify-between">
                <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 space-y-0 min-w-0">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 break-words min-w-0">{instance.name}</CardTitle>
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
                    {isConnected ? "Conectado" : "Aguardando QR"}
                  </span>
                </CardHeader>
                <CardContent className="p-4 pt-3 space-y-3">
                  {instance.phone ? (
                    <p className="text-xs text-slate-500">
                      Número: <span className="font-semibold text-slate-800">{instance.phone}</span>
                    </p>
                  ) : null}

                  {isConnected && (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenWarmup(instance)}
                        className={`w-full justify-start text-xs font-semibold h-8 px-2 ${getWarmupHealth(instance).color} hover:opacity-80`}
                      >
                        {(() => {
                          const Icon = getWarmupHealth(instance).icon;
                          return <Icon className="mr-2 h-4 w-4" />;
                        })()}
                        {getWarmupHealth(instance).text}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {!isConnected ? (
                      <Button
                        size="sm"
                        onClick={() => void handleOpenQr(instance)}
                        disabled={isCheckingStatus}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                      >
                        {isCheckingStatus ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <QrCode className="h-3.5 w-3.5" />
                        )}
                        Escanear QR Code
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          setIsCheckingStatus(true);
                          await checkStatus(instance, false).catch(() => null);
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
          <Card className="w-full max-w-sm border-slate-200 bg-white shadow-xl">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Conectar Novo WhatsApp</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dê um nome para identificar este número/atendente.
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
                    Nome da Instância / Atendente
                  </Label>
                  <Input
                    id="inst-name"
                    required
                    autoFocus
                    placeholder="Ex: Comercial 01 · Matheus"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <p className="text-xs text-slate-400">
                    Este nome aparece na lista de conexões.
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
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    Gerar QR Code
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      ) : null}

      {/* MODAL QR CODE COM AUTO-DETECT */}
      {activeQrInstance && qrCodeData ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm border-slate-200 bg-white shadow-2xl">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Escanear QR Code</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">{activeQrInstance.name}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseQr}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-center">
              <p className="text-xs text-slate-500">
                Abra o WhatsApp no celular &gt; <strong>Aparelhos conectados</strong> &gt;{" "}
                <strong>Conectar aparelho</strong> e escaneie o código.
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
                  className="h-56 w-56 rounded"
                />
              </div>

              {isPolling ? (
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-medium animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Aguardando escaneamento...
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseQr}
                  className="flex-1 text-xs"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    setIsCheckingStatus(true);
                    try {
                      const status = await checkStatus(activeQrInstance, false);
                      if (status === "open") {
                        handleCloseQr();
                        toast({
                          title: "✅ Conectado!",
                          description: "WhatsApp conectado com sucesso.",
                          variant: "success",
                        });
                        void loadInstances();
                      } else {
                        toast({
                          title: "Aguardando leitura",
                          description: "Escaneie o QR Code acima com o WhatsApp.",
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
                  Já Escaneei
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* MODAL MATURADOR */}
      {warmupInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between space-y-0 shrink-0">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  Maturador do Chip
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acompanhamento de segurança para evitar banimento no WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWarmupInstance(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 overflow-y-auto space-y-6">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 font-medium">
                Siga as etapas abaixo ao longo dos dias usando seu celular. 
                Só dispare em massa após concluir o aquecimento para não perder o número.
              </div>
              
              <div className="space-y-6">
                {WARMUP_TASKS.map((dayPlan) => (
                  <div key={dayPlan.day} className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-800">{dayPlan.title}</h4>
                    <div className="space-y-2">
                      {dayPlan.tasks.map((task) => (
                        <label key={task.id} className="flex items-start gap-2 cursor-pointer group">
                          <div className="flex items-center h-5">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                              checked={warmupProgress[task.id] || false}
                              onChange={(e) => {
                                setWarmupProgress(prev => ({ ...prev, [task.id]: e.target.checked }));
                              }}
                            />
                          </div>
                          <span className={`text-sm ${warmupProgress[task.id] ? "text-slate-400 line-through" : "text-slate-700"}`}>
                            {task.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <Button variant="outline" onClick={() => setWarmupInstance(null)} disabled={isSavingWarmup}>
                  Fechar
                </Button>
                <Button 
                  onClick={() => void handleSaveWarmup()} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isSavingWarmup}
                >
                  {isSavingWarmup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Salvar Progresso
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
