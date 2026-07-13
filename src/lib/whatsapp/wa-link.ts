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

export function createWhatsAppWebLink({ phone, message }: WaLinkParams) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    throw new Error("Lead sem WhatsApp mÃ³vel vÃ¡lido.");
  }

  const params = new URLSearchParams({
    app_absent: "0",
    phone: normalizedPhone,
    text: message,
    type: "phone_number",
  });

  return `https://web.whatsapp.com/send?${params.toString()}`;
}

export function createWhatsAppAppLink({ phone, message }: WaLinkParams) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    throw new Error("Lead sem WhatsApp mÃ³vel vÃ¡lido.");
  }

  const params = new URLSearchParams({
    phone: normalizedPhone,
    text: message,
  });

  return `whatsapp://send?${params.toString()}`;
}

export function isMobileWhatsappEnvironment() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
