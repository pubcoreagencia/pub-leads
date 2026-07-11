import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeInfo, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CheckoutPlan = "mensal" | "anual" | "vitalicio";

const checkoutCopy: Record<
  CheckoutPlan,
  {
    name: string;
    description: string;
    note: string;
  }
> = {
  mensal: {
    name: "Plano Mensal",
    description: "Mock de desenvolvimento para simular a etapa de checkout mensal.",
    note: "Nenhum pagamento real será processado nesta rota.",
  },
  anual: {
    name: "Plano Anual",
    description: "Mock de desenvolvimento para simular a etapa de checkout anual.",
    note: "Use esta tela apenas para validar o fluxo de navegação.",
  },
  vitalicio: {
    name: "Plano Vitalício",
    description: "Mock de desenvolvimento para simular a compra vitalícia.",
    note: "O fluxo real de cobrança ainda não está conectado.",
  },
};

export default async function CheckoutPlanPage({
  params,
}: Readonly<{ params: Promise<{ plan: string }> }>) {
  const { plan } = await params;

  if (!(plan in checkoutCopy)) {
    notFound();
  }

  const planId = plan as CheckoutPlan;
  const copy = checkoutCopy[planId];

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center px-4 py-10">
      <Card className="w-full border-slate-200 bg-white shadow-premium">
        <CardHeader>
          <div className="mb-3 inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            Checkout mock
          </div>
          <CardTitle>{copy.name}</CardTitle>
          <p className="text-sm leading-6 text-slate-500">{copy.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <BadgeInfo className="mt-0.5 h-5 w-5 text-red-700" />
              <div className="space-y-2 text-sm leading-6 text-slate-600">
                <p>{copy.note}</p>
                <p className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Esta página existe apenas para evitar 404 enquanto o checkout real não é integrado.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/app/billing">Voltar ao billing</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Ir para o dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
