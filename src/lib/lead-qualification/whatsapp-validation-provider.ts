import { classifyBrazilPhone, type BrazilPhoneType } from "@/src/lib/lead-qualification/phone-normalization";

export type WhatsappValidationResult = {
  checkedAt: string;
  normalizedNumber: string | null;
  source: "direct_whatsapp_link" | "official_provider" | "mobile_pattern" | "phone_field" | "website_link" | "manual" | "none";
  status: "confirmed" | "not_on_whatsapp" | "unknown" | "error";
};

export type WhatsappValidationProvider = {
  id: "direct-link" | "local-pattern" | "official-provider";
  validate(input: { phone?: string | null }): Promise<WhatsappValidationResult>;
};

export function localPatternProvider(phone: string | null | undefined) {
  const classification = classifyBrazilPhone(phone);

  return {
    checkedAt: new Date().toISOString(),
    normalizedNumber: classification.normalized,
    phoneType: classification.phoneType as BrazilPhoneType,
    source: classification.phoneType === "mobile" ? "mobile_pattern" : "phone_field",
    status: "unknown" as const,
  };
}

// Reserved for an explicitly configured official provider. It never performs network calls by default.
export const officialProvider: WhatsappValidationProvider = {
  id: "official-provider",
  async validate({ phone }) {
    return {
      checkedAt: new Date().toISOString(),
      normalizedNumber: classifyBrazilPhone(phone).normalized,
      source: "none",
      status: "unknown",
    };
  },
};
