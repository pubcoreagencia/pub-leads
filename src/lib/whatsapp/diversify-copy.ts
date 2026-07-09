import type { Lead } from "@/schemas/lead";

export type DiversifyCopyInput = {
  city?: string | null;
  copyBase: string;
  lead: Lead;
  niche?: string | null;
  variantSeed?: number;
};

const placeholderPattern = /\{(nome|empresa|cidade|nicho|telefone|site)\}/gi;

function cleanInlineText(value: string) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function leadCompany(lead: Lead) {
  return lead.company || lead.business_name || lead.fantasy_name || lead.name;
}

function leadPhone(lead: Lead) {
  return lead.whatsapp || lead.phone || lead.phone_2 || "";
}

function replacePlaceholders({ city, copyBase, lead, niche }: DiversifyCopyInput) {
  const values: Record<string, string> = {
    cidade: city?.trim() || lead.city || "",
    empresa: leadCompany(lead),
    nicho: niche?.trim() || lead.category || "",
    nome: lead.name,
    site: lead.website || "",
    telefone: leadPhone(lead),
  };

  return cleanInlineText(
    copyBase.replace(placeholderPattern, (_match, key: string) => values[key.toLowerCase()] ?? ""),
  );
}

function splitFirstSentence(message: string) {
  const match = message.match(/^([\s\S]{18,180}?[.!?])\s+([\s\S]+)$/);

  if (!match) {
    return message;
  }

  return `${match[1]}\n\n${match[2]}`;
}

function softenGreeting(message: string, variant: number) {
  const greetings = [
    ["Olá", "Oi"],
    ["Oi", "Olá"],
    ["Bom dia", "Olá"],
    ["Boa tarde", "Olá"],
  ] as const;

  const [from, to] = greetings[variant % greetings.length];
  const pattern = new RegExp(`^${from}\\b`, "i");

  return message.replace(pattern, to);
}

function applySmallWordChanges(message: string, variant: number) {
  const changes = [
    [/Tudo bem\?/i, "Tudo certo?"],
    [/\bGostaria de\b/i, "Queria"],
    [/\bQueria\b/i, "Gostaria de"],
    [/\brápido\b/i, "breve"],
    [/\bpor aqui\?/i, "por aqui mesmo?"],
    [/\bpodemos conversar\b/i, "conseguimos conversar"],
  ] as const;

  return changes.reduce((current, [pattern, replacement], index) => {
    if ((variant + index) % 2 !== 0) {
      return current;
    }

    return current.replace(pattern, replacement);
  }, message);
}

function adjustClosing(message: string, variant: number) {
  const closings = [
    ["Pode ser?", "Faz sentido?"],
    ["Faz sentido?", "Pode ser?"],
    ["Me avisa?", "Me chama por aqui?"],
    ["Topa?", "Faz sentido?"],
  ] as const;

  const [from, to] = closings[variant % closings.length];

  return message.replace(new RegExp(`${from.replace("?", "\\?")}$`, "i"), to);
}

export function diversifyBaseCopy(input: DiversifyCopyInput) {
  const base = replacePlaceholders(input);
  const variant = Math.abs(Math.trunc(input.variantSeed ?? 0)) % 6;

  if (variant === 0) {
    return base;
  }

  let message = base;

  if (variant === 1 || variant === 4) {
    message = softenGreeting(message, variant);
  }

  if (variant === 2 || variant === 5) {
    message = applySmallWordChanges(message, variant);
  }

  if (variant === 3 || variant === 5) {
    message = splitFirstSentence(message);
  }

  if (variant === 4) {
    message = adjustClosing(message, variant);
  }

  return cleanInlineText(message);
}
