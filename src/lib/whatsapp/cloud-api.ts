import type { WhatsAppMessageDraft, WhatsAppProvider } from "@/src/lib/whatsapp/provider";

export const whatsAppCloudApiProvider: WhatsAppProvider = {
  id: "cloud-api",
  name: "WhatsApp Cloud API",
  createMessageLink(draft: WhatsAppMessageDraft) {
    void draft;
    throw new Error("WhatsApp Cloud API ainda nao esta habilitada neste MVP.");
  },
};

export async function sendViaWhatsAppCloudApi() {
  throw new Error("Envio automatico pelo WhatsApp Cloud API nao faz parte do MVP.");
}
