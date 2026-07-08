import Link from "next/link";
import { ArrowRight, BarChart3, MessageCircle, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const highlights = [
  {
    title: "Prospecção",
    description: "Base preparada para leads por OpenStreetMap e Overpass.",
    icon: Search,
  },
  {
    title: "Pipeline",
    description: "Fundação visual para CRM e etapas comerciais.",
    icon: BarChart3,
  },
  {
    title: "WhatsApp manual",
    description: "MVP orientado a links wa.me com mensagens prontas.",
    icon: MessageCircle,
  },
];

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
            PubLeads SaaS
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              CRM e prospecção B2B em uma base premium.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Fundação visual para capturar leads, organizar oportunidades e preparar
              abordagens comerciais com consistência.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/app/dashboard">
                Abrir dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        </div>

        <Card className="border-purple-100 shadow-premium">
          <CardHeader>
            <CardTitle>Operação comercial</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {highlights.map((item) => (
              <div
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4"
                key={item.title}
              >
                <div className="rounded-md bg-purple-100 p-2 text-purple-700">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
