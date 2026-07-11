"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadSourceLabels, leadStatusLabels } from "@/config/pipeline";
import { toast } from "@/hooks/use-toast";
import type { Lead, LeadFormValues, LeadNote } from "@/schemas/lead";
import { leadFormSchema, leadSourceSchema, leadStatusSchema } from "@/schemas/lead";
import {
  addLeadNote,
  createLead,
  deleteLead,
  fetchLeadNotes,
  updateLead,
} from "@/services/leads";

type LeadDetailModalProps = {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

const defaultValues: LeadFormValues = {
  name: "",
  company: "",
  category: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  website: "",
  address: "",
  city: "",
  state: "",
  country: "",
  status: "new",
  source: "manual",
};

function readInstagramValue(lead: Lead) {
  const handle = typeof lead.metadata.instagram_handle === "string" ? lead.metadata.instagram_handle.trim() : "";
  const url = typeof lead.metadata.instagram_url === "string" ? lead.metadata.instagram_url.trim() : "";

  if (handle) {
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  if (url) {
    return url;
  }

  return "";
}

function leadToFormValues(lead: Lead | null): LeadFormValues {
  if (!lead) {
    return defaultValues;
  }

  return {
    name: lead.name,
    company: lead.company ?? "",
    category: lead.category ?? "",
    phone: lead.phone ?? "",
    whatsapp: lead.whatsapp ?? "",
    email: lead.email ?? "",
    instagram: readInstagramValue(lead),
    website: lead.website ?? "",
    address: lead.address ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    country: lead.country ?? "",
    status: lead.status,
    source: lead.source,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailModal({ lead, open, onClose, onChanged }: LeadDetailModalProps) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const isEditing = Boolean(lead);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(leadToFormValues(lead));

    if (!lead) {
      setNotes([]);
      return;
    }

    let active = true;
    setIsLoadingNotes(true);
    fetchLeadNotes(lead.id)
      .then((items) => {
        if (active) {
          setNotes(items);
        }
      })
      .catch((error) => {
        toast({
          title: "Erro ao carregar notas",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "error",
        });
      })
      .finally(() => {
        if (active) {
          setIsLoadingNotes(false);
        }
      });

    return () => {
      active = false;
    };
  }, [lead, open, reset]);

  async function onSubmit(values: LeadFormValues) {
    setIsSaving(true);

    try {
      if (lead) {
        await updateLead(lead.id, values);
        toast({ title: "Lead atualizado", variant: "success" });
      } else {
        await createLead(values);
        toast({ title: "Lead criado", variant: "success" });
      }

      onChanged();
      onClose();
    } catch (error) {
      toast({
        title: "Erro ao salvar lead",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!lead || !window.confirm("Excluir este lead?")) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteLead(lead.id);
      toast({ title: "Lead excluido", variant: "success" });
      onChanged();
      onClose();
    } catch (error) {
      toast({
        title: "Erro ao excluir lead",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAddNote() {
    if (!lead || noteContent.trim().length === 0) {
      return;
    }

    setIsAddingNote(true);

    try {
      const note = await addLeadNote(lead.id, noteContent);
      setNotes((current) => [note, ...current]);
      setNoteContent("");
      toast({ title: "Nota adicionada", variant: "success" });
    } catch (error) {
      toast({
        title: "Erro ao adicionar nota",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsAddingNote(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-premium">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {isEditing ? "Detalhes do lead" : "Novo lead"}
            </h2>
            <p className="text-sm text-slate-500">
              Edite dados comerciais e registre notas internas.
            </p>
          </div>
          <Button onClick={onClose} size="icon" type="button" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid max-h-[calc(92vh-73px)] gap-0 overflow-y-auto lg:grid-cols-[1.25fr_0.75fr]">
          <form className="space-y-5 p-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" placeholder="Nome do lead" {...register("name")} />
                {errors.name ? <p className="text-sm text-red-600">{errors.name.message}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company">Empresa</Label>
                <Input id="company" placeholder="Empresa" {...register("company")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Input id="category" placeholder="Ex: Restaurante" {...register("category")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" placeholder="Telefone" {...register("phone")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" placeholder="WhatsApp" {...register("whatsapp")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="email@empresa.com" {...register("email")} />
                {errors.email ? <p className="text-sm text-red-600">{errors.email.message}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input id="instagram" placeholder="@empresa ou URL do perfil" {...register("instagram")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="website">Site</Label>
                <Input id="website" placeholder="https://empresa.com" {...register("website")} />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="address">Endereco</Label>
                <Input id="address" placeholder="Endereco completo" {...register("address")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" placeholder="Cidade" {...register("city")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="state">Estado</Label>
                <Input id="state" placeholder="Estado" {...register("state")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country">Pais</Label>
                <Input id="country" placeholder="Pais" {...register("country")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  id="status"
                  {...register("status")}
                >
                  {leadStatusSchema.options.map((status) => (
                    <option key={status} value={status}>
                      {leadStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="source">Origem</Label>
                <select
                  className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  id="source"
                  {...register("source")}
                >
                  {leadSourceSchema.options.map((source) => (
                    <option key={source} value={source}>
                      {leadSourceLabels[source]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
              {lead ? (
                <Button
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={isDeleting || isSaving}
                  onClick={handleDelete}
                  type="button"
                  variant="ghost"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Excluir
                </Button>
              ) : (
                <span />
              )}
              <Button disabled={isSaving || isDeleting} type="submit">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar lead
              </Button>
            </div>
          </form>

          <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-950">Notas internas</h3>
              <p className="mt-1 text-sm text-slate-500">
                Registre contexto comercial sem enviar mensagens externas.
              </p>
            </div>

            {lead ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <textarea
                    className="min-h-24 rounded-md border border-input bg-white p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder="Adicionar nota..."
                    value={noteContent}
                  />
                  <Button disabled={isAddingNote || noteContent.trim().length === 0} onClick={handleAddNote} type="button">
                    {isAddingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Adicionar nota
                  </Button>
                </div>

                {isLoadingNotes ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando notas...
                  </div>
                ) : notes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    Nenhuma nota interna ainda.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {notes.map((note) => (
                      <div className="rounded-lg border border-slate-200 bg-white p-3" key={note.id}>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.content}</p>
                        <p className="mt-2 text-xs text-slate-400">{formatDate(note.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Salve o lead antes de adicionar notas.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
