"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/schemas/auth";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message && error.message !== "{}") {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message && message !== "{}") {
      return message;
    }
  }

  return "Nao foi possivel atualizar a senha.";
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      confirmPassword: "",
      password: "",
    },
  });

  useEffect(() => {
    let active = true;

    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }

        setHasSession(Boolean(data.session));
      })
      .finally(() => {
        if (active) {
          setCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: ResetPasswordFormValues) {
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Senha atualizada",
        description: "Você já pode entrar com a nova senha.",
        variant: "success",
      });
      router.replace("/login?password-reset=1");
      router.refresh();
    } catch (error) {
      toast({
        title: "Nao foi possivel atualizar a senha",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-10">
      <Card className="w-full border-slate-200 bg-white shadow-premium">
        <CardHeader>
          <CardTitle>Definir nova senha</CardTitle>
          <CardDescription>
            Use o link de recuperação enviado por email para criar uma nova senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingSession ? (
            <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              Verificando sessão...
            </div>
          ) : !hasSession ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Este link precisa ser aberto a partir do email de recuperação.
                Se ele expirou, solicite um novo link de redefinição.
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link href="/forgot-password">Solicitar novo link</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  placeholder="Digite a nova senha"
                  type="password"
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  placeholder="Repita a nova senha"
                  type="password"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword ? (
                  <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                Requisitos atuais: mínimo de 6 caracteres. Confirme se ambas as senhas são iguais.
              </div>

              <Button className="w-full" disabled={isSubmitting || !watch("password")} type="submit">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                Atualizar senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
