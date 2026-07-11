"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { authFormSchema, type AuthFormValues, type AuthMode } from "@/schemas/auth";

type AuthFormProps = {
  mode: AuthMode;
};

const copyByMode = {
  login: {
    title: "Entrar",
    description: "Acesse seu workspace comercial.",
    primaryAction: "Entrar",
    secondaryHref: "/forgot-password",
    secondaryLabel: "Esqueci minha senha",
  },
  register: {
    title: "Criar conta",
    description: "Crie a base inicial da sua operacao.",
    primaryAction: "Criar conta",
    secondaryHref: "/login",
    secondaryLabel: "Ja tenho conta",
  },
  "forgot-password": {
    title: "Recuperar senha",
    description: "Receba instrucoes para recuperar o acesso.",
    primaryAction: "Enviar link",
    secondaryHref: "/login",
    secondaryLabel: "Voltar ao login",
  },
} satisfies Record<AuthMode, Record<string, string>>;

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message && error.message !== "{}") {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message && message !== "{}") {
      return message;
    }
  }

  if (typeof error === "string" && error && error !== "{}") {
    return error;
  }

  return "Verifique email, senha e configuracao do Supabase.";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const copy = copyByMode[mode];

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      name: mode === "register" ? "" : undefined,
      email: "",
      password: mode === "forgot-password" ? undefined : "",
    },
  });

  async function onSubmit(values: AuthFormValues) {
    if (!hasSupabaseConfig()) {
      toast({
        title: "Supabase nao configurado",
        description: "Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password ?? "",
        });

        if (error) {
          throw error;
        }

        toast({ title: "Login realizado", variant: "success" });
        router.push(searchParams.get("redirectTo") ?? "/app/dashboard");
        router.refresh();
        return;
      }

      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password ?? "",
          options: {
            data: {
              full_name: values.name,
            },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/app/dashboard`,
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          toast({ title: "Conta criada", variant: "success" });
          router.push("/app/dashboard");
          router.refresh();
          return;
        }

        toast({
          title: "Cadastro iniciado",
          description: "Confira seu email para confirmar a conta.",
          variant: "success",
        });
        router.push("/login");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Email enviado",
        description: "Confira sua caixa de entrada para recuperar o acesso.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Nao foi possivel continuar",
        description: getAuthErrorMessage(error),
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
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {mode === "register" ? (
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" placeholder="Seu nome" type="text" {...register("name")} />
                {errors.name ? (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" placeholder="voce@empresa.com" type="email" {...register("email")} />
              {errors.email ? (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              ) : null}
            </div>

            {mode !== "forgot-password" ? (
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  placeholder="Sua senha"
                  type="password"
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                ) : null}
              </div>
            ) : null}

            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Processando..." : copy.primaryAction}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-slate-500">
            <Link className="font-medium text-red-700 hover:text-red-800" href={copy.secondaryHref}>
              {copy.secondaryLabel}
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
