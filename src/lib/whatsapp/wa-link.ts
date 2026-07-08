export type WaLinkParams = {
  phone: string;
  message: string;
};

export function normalizeWhatsAppPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function createWaLink({ phone, message }: WaLinkParams) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    throw new Error("Lead sem telefone ou WhatsApp valido.");
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
