import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";
import { ProspectingVfxCanvas } from "@/components/vfx/prospecting-vfx-canvas";

import "./globals.css";

export const metadata: Metadata = {
  title: "PubLeads | Prospecção B2B & Abordagem WhatsApp",
  description: "Encontre leads qualificados, descubra WhatsApp, Instagram e Email e aborde com alta conversão.",
  metadataBase: new URL("https://publeads.vercel.app"),
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <ProspectingVfxCanvas />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
