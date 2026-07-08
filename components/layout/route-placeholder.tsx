import type { LucideIcon } from "lucide-react";

import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { Card, CardContent } from "@/components/ui/card";

type RoutePlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function RoutePlaceholder({ title, description, icon: Icon }: RoutePlaceholderProps) {
  return (
    <DashboardPageShell description={description} title={title}>
      <Card className="border-dashed border-slate-300 bg-white shadow-sm">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 rounded-lg bg-purple-100 p-3 text-purple-700">
            <Icon className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Estrutura pronta para a proxima fase.
          </p>
        </CardContent>
      </Card>
    </DashboardPageShell>
  );
}
