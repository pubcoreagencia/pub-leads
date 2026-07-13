"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type ProfileNameFormProps = {
  initialName: string;
};

export function ProfileNameForm({ initialName }: ProfileNameFormProps) {
  const [fullName, setFullName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (fullName.trim().length < 2) {
      toast({
        title: "Nome muito curto",
        description: "Informe o nome que deve aparecer nas mensagens do funil.",
        variant: "error",
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify({ fullName }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json()) as { error?: string; fullName?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível salvar o nome.");
      }

      setFullName(payload.fullName ?? fullName);
      toast({
        title: "Nome atualizado",
        description: "As próximas mensagens do funil usarão esse nome.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar nome",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="profile-full-name">Nome exibido nas mensagens</Label>
        <Input
          id="profile-full-name"
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Ex: Luana"
          value={fullName}
        />
      </div>
      <p className="text-sm leading-6 text-slate-500">
        Esse nome preenche o placeholder {"{operador}"} no funil de mensagens.
      </p>
      <Button className="w-full sm:w-fit" disabled={isSaving} type="submit">
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar nome
      </Button>
    </form>
  );
}
