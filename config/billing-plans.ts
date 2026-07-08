import type { LucideIcon } from "lucide-react";
import { Crown, Infinity as InfinityIcon, Sparkles, Zap } from "lucide-react";

export type BillingPlanId = "free" | "mensal" | "anual" | "vitalicio";

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  type: string;
  price: string;
  icon: LucideIcon;
  benefits: string[];
  buttonLabel: string;
  checkoutHref: string;
  leadLimit: number | null;
  searchLimit: number | null;
  whatsappInstances: number | null;
  pipelineLimit: number | null;
  badge?: string;
  note?: string;
  featured?: boolean;
  lifetime?: boolean;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    type: "FREE",
    price: "R$ 0",
    icon: Sparkles,
    benefits: ["100 leads", "5 buscas/mês", "WhatsApp manual", "1 pipeline"],
    buttonLabel: "Plano atual",
    checkoutHref: "",
    leadLimit: 100,
    pipelineLimit: 1,
    searchLimit: 5,
    whatsappInstances: 1,
  },
  {
    id: "mensal",
    name: "Plano Mensal",
    type: "MENSAL",
    price: "R$ 147,99/mês",
    icon: Zap,
    benefits: [
      "10.000 leads/mês",
      "50 buscas/mês",
      "2 instâncias WhatsApp",
      "3 pipelines de vendas",
      "+2 benefícios",
    ],
    buttonLabel: "Assinar",
    checkoutHref: "/checkout/mensal",
    leadLimit: 10000,
    pipelineLimit: 3,
    searchLimit: 50,
    whatsappInstances: 2,
  },
  {
    id: "anual",
    name: "Plano Anual",
    type: "ANUAL",
    price: "R$ 497,99/ano",
    icon: Crown,
    benefits: [
      "Leads ilimitados",
      "Buscas ilimitadas",
      "10 instâncias WhatsApp",
      "Pipelines ilimitados",
      "+6 benefícios",
    ],
    buttonLabel: "Assinar",
    checkoutHref: "/checkout/anual",
    leadLimit: null,
    pipelineLimit: null,
    searchLimit: null,
    whatsappInstances: 10,
    badge: "MAIS POPULAR",
    featured: true,
  },
  {
    id: "vitalicio",
    name: "Plano Vitalício",
    type: "VITALÍCIO",
    price: "R$ 997,98/único",
    icon: InfinityIcon,
    benefits: [
      "Tudo liberado para sempre",
      "Leads ilimitados",
      "Buscas ilimitadas",
      "Instâncias WhatsApp ilimitadas",
      "+8 benefícios",
    ],
    buttonLabel: "Comprar agora",
    checkoutHref: "/checkout/vitalicio",
    leadLimit: null,
    pipelineLimit: null,
    searchLimit: null,
    whatsappInstances: null,
    badge: "MELHOR CUSTO",
    note: "Pagamento único - acesso para sempre",
    lifetime: true,
  },
];

export const paidBillingPlans = billingPlans.filter((plan) => plan.id !== "free");
