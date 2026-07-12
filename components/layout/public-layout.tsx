import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.10),transparent_34rem),linear-gradient(180deg,#ffffff_0%,#fff7f7_100%)]">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2 font-semibold text-slate-950" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            PubLeads
          </Link>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="px-3 sm:px-4" size="sm">
              <Link href="/register">Criar conta</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
