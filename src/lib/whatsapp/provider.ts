import { createWhatsAppWebLink } from "@/src/lib/whatsapp/wa-link";

export type WhatsAppMessageDraft = {
  phone: string;
  message: string;
};

export type WhatsAppProvider = {
  id: "manual-wa-link" | "cloud-api";
  name: string;
  createMessageLink(draft: WhatsAppMessageDraft): string;
};

export const manualWhatsAppProvider: WhatsAppProvider = {
  id: "manual-wa-link",
  name: "WhatsApp manual via WhatsApp Web",
  createMessageLink(draft) {
    return createWhatsAppWebLink(draft);
  },
};
