export type BrazilPhoneType = "mobile" | "landline" | "invalid" | "unknown" | "missing";

export type BrazilianPhoneClassification = {
  normalized: string | null;
  phoneType: BrazilPhoneType;
};

export function normalizeBrazilPhone(raw: string | null | undefined) {
  let digits = raw?.replace(/\D/g, "") ?? "";

  if (!digits) {
    return null;
  }

  if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }

  return null;
}

export function classifyBrazilPhone(raw: string | null | undefined): BrazilianPhoneClassification {
  const rawDigits = raw?.replace(/\D/g, "") ?? "";

  if (!rawDigits) {
    return { normalized: null, phoneType: "missing" };
  }

  const normalized = normalizeBrazilPhone(raw);

  if (!normalized) {
    return { normalized: null, phoneType: "invalid" };
  }

  const local = normalized.slice(4);

  if (local.length === 9 && local.startsWith("9")) {
    return { normalized, phoneType: "mobile" };
  }

  if (local.length === 8 && /^[2345]/.test(local)) {
    return { normalized, phoneType: "landline" };
  }

  return { normalized, phoneType: "unknown" };
}

export function isBrazilianMobile(raw: string | null | undefined) {
  return classifyBrazilPhone(raw).phoneType === "mobile";
}

export function isBrazilianLandline(raw: string | null | undefined) {
  return classifyBrazilPhone(raw).phoneType === "landline";
}

export function getWhatsappCandidate(raw: string | null | undefined) {
  const classification = classifyBrazilPhone(raw);

  return classification.phoneType === "mobile" ? classification.normalized : null;
}
