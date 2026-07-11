import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BarChart3,
  CreditCard,
  KanbanSquare,
  LayoutDashboard,
  MessageCircle,
  Search,
  Settings,
  Users,
} from "lucide-react";

export type DashboardNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const dashboardNavItems: DashboardNavItem[] = [
  { title: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { title: "Prospecção", href: "/app/scraper", icon: Search },
  { title: "Leads", href: "/app/leads", icon: Users },
  { title: "Pipeline", href: "/app/pipeline", icon: KanbanSquare },
  { title: "Abordagem", href: "/app/whatsapp", icon: MessageCircle },
  { title: "Analytics", href: "/app/analytics", icon: BarChart3 },
  { title: "Assinatura", href: "/app/billing", icon: CreditCard },
  { title: "Planos", href: "/app/planos", icon: BadgeDollarSign },
  { title: "Configurações", href: "/app/config", icon: Settings },
];
