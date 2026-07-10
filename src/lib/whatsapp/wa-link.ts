export type WaLinkParams = {
  phone: string;
  message: string;
};

import { getWhatsappCandidate } from "@/src/lib/lead-qualification/phone-normalization";

export function normalizeWhatsAppPhone(phone: string) {
  return getWhatsappCandidate(phone) ?? "";
}

export function createWaLink({ phone, message }: WaLinkParams) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    throw new Error("Lead sem WhatsApp móvel válido.");
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
