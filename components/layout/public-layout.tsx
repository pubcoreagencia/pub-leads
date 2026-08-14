import type { ReactNode } from "react";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { UtmCapture } from "@/components/tracking/utm-capture";

export function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(220,38,38,0.15),rgba(255,255,255,0))]">
      <Suspense fallback={null}>
        <UtmCapture />
      </Suspense>
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3" href="/">
            <Image
              alt="PubLeads Logo"
              className="h-10 w-auto object-contain transition-transform hover:scale-105"
              height={48}
              priority
              src="/brand/publeads-logo.png"
              width={160}
            />
          </Link>
          <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button asChild size="sm" variant="ghost" className="font-semibold text-slate-700 hover:text-red-600">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="px-4 bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20" size="sm">
              <Link href="/register">Começar Agora</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
