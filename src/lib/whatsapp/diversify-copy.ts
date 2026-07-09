import type { Lead } from "@/schemas/lead";

export type DiversifyBaseCopyInput = {
  baseCopy?: string;
  city?: string | null;
  copyBase?: string;
  lead?: Lead;
  leadName?: string | null;
  niche?: string | null;
  variantSeed?: number;
};

function cleanInlineText(value: string) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function leadCompany(lead: Lead | undefined, explicitLeadName?: string | null) {
  return (
    explicitLeadName?.trim() ||
    lead?.company ||
    lead?.business_name ||
    lead?.fantasy_name ||
    lead?.name ||
    "Voces"
  );
}

function leadPhone(lead: Lead | undefined) {
  return lead?.whatsapp || lead?.phone || lead?.phone_2 || "";
}

function replaceAllPatterns(value: string, patterns: RegExp[], replacement: string) {
  return patterns.reduce((current, pattern) => current.replace(pattern, replacement), value);
}

function replacePlaceholders(input: DiversifyBaseCopyInput) {
  const lead = input.lead;
  const baseCopy = input.baseCopy ?? input.copyBase ?? "";
  const leadDisplayName = leadCompany(lead, input.leadName);
  const city = input.city?.trim() || lead?.city || "";
  const niche = input.niche?.trim() || lead?.category || "";
  const site = lead?.website || "";
  const phone = leadPhone(lead);

  let message = baseCopy;

  message = replaceAllPatterns(message, [/\{cidade\}/gi, /\[CIDADE\]/g, /\bCIDADE\b/g], city);
  message = replaceAllPatterns(
    message,
    [/\{nicho\}/gi, /\[NICHO\]/g, /\bNICHO\b/g, /\{copy\}/gi, /\bCOPY\b/g],
    niche,
  );
  message = replaceAllPatterns(
    message,
    [/\{lead\}/gi, /\[LEAD\]/g, /\bLEAD\b/g, /\{empresa\}/gi, /\bEMPRESA\b/g],
    leadDisplayName,
  );
  message = replaceAllPatterns(message, [/\{nome\}/gi], lead?.name || leadDisplayName);
  message = replaceAllPatterns(message, [/\{telefone\}/gi], phone);
  message = replaceAllPatterns(message, [/\{site\}/gi], site);

  return cleanInlineText(message);
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function replaceFirst(message: string, replacements: Array<[RegExp, string]>) {
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(message)) {
      return message.replace(pattern, replacement);
    }
  }

  return message;
}

function varyGreeting(message: string, variant: number) {
  const replacements: Array<[RegExp, string]> =
    variant % 2 === 0
      ? [
          [/^Olá,?\s*/i, "Oi, "],
          [/^Ola,?\s*/i, "Oi, "],
          [/^Oi,?\s*/i, "Olá, "],
          [/^Bom dia,?\s*/i, "Olá, "],
          [/^Boa tarde,?\s*/i, "Olá, "],
        ]
      : [
          [/^Oi,?\s*/i, "Olá, "],
          [/^Olá,?\s*/i, "Oi, "],
          [/^Ola,?\s*/i, "Oi, "],
          [/^Tudo bem\??\s*/i, "Oi, tudo bem? "],
        ];

  return replaceFirst(message, replacements);
}

function varyCommercialWords(message: string, variant: number) {
  const groups: Array<Array<[RegExp, string]>> = [
    [
      [/\bestamos selecionando\b/i, "estamos separando"],
      [/\bEstamos selecionando\b/, "Estamos separando"],
      [/\bselecionamos\b/i, "separamos"],
      [/\bselecionando\b/i, "separando"],
    ],
    [
      [/\bestamos entrando em contato\b/i, "entramos em contato"],
      [/\bEstamos entrando em contato\b/, "Entramos em contato"],
      [/\bentrando em contato\b/i, "falando com voce"],
    ],
    [
      [/\bgrande potencial\b/i, "potencial claro"],
      [/\bpotencial grande\b/i, "potencial claro"],
      [/\bboa oportunidade\b/i, "oportunidade clara"],
    ],
    [
      [/\bcaso faça sentido\b/i, "se fizer sentido"],
      [/\bcaso faca sentido\b/i, "se fizer sentido"],
      [/\bse fizer sentido\b/i, "caso faca sentido"],
    ],
    [
      [/\bposso te enviar mais detalhes\?/i, "quer que eu te envie mais detalhes?"],
      [/\bposso te mandar mais detalhes\?/i, "quer que eu te mande mais detalhes?"],
      [/\bposso te explicar melhor\?/i, "quer que eu te explique melhor?"],
    ],
  ];

  const selected = groups[variant % groups.length];

  return replaceFirst(message, selected);
}

function varyLineBreaks(message: string, variant: number) {
  const firstSentence = message.match(/^([\s\S]{24,220}?[.!?])\s+([\s\S]+)$/);

  if (firstSentence && variant % 2 === 0) {
    return `${firstSentence[1]}\n\n${firstSentence[2]}`;
  }

  const comma = message.match(/^([\s\S]{12,120}?,)\s+([\s\S]+)$/);

  if (comma) {
    return `${comma[1]}\n${comma[2]}`;
  }

  return message;
}

function varyPunctuation(message: string) {
  if (message.endsWith(".")) {
    return `${message.slice(0, -1)}...`;
  }

  if (!/[.!?]$/.test(message)) {
    return `${message}.`;
  }

  return message;
}

function splitNearMiddle(message: string) {
  const middle = Math.floor(message.length / 2);
  const afterMiddle = message.slice(middle).search(/\s/);
  const splitIndex = afterMiddle >= 0 ? middle + afterMiddle : message.lastIndexOf(" ", middle);

  if (splitIndex <= 20 || splitIndex >= message.length - 20) {
    if (message.length > 40) {
      return `${message.slice(0, middle).trim()}\n${message.slice(middle).trim()}`;
    }

    return varyPunctuation(message);
  }

  return `${message.slice(0, splitIndex).trim()}\n${message.slice(splitIndex).trim()}`;
}

function forceSafeVariation(message: string) {
  const withGreeting = varyGreeting(message, 0);

  if (withGreeting !== message) {
    return withGreeting;
  }

  const withWords = varyCommercialWords(message, 0);

  if (withWords !== message) {
    return withWords;
  }

  const withBreak = varyLineBreaks(message, 0);

  if (withBreak !== message) {
    return withBreak;
  }

  return splitNearMiddle(message);
}

export function diversifyBaseCopy(input: DiversifyBaseCopyInput) {
  const base = replacePlaceholders(input);
  const seedSource = [
    input.variantSeed ?? 0,
    input.lead?.id,
    input.lead?.name,
    input.leadName,
    input.baseCopy ?? input.copyBase,
  ]
    .filter(Boolean)
    .join("|");
  const variant = hashText(seedSource) % 8;
  let message = base;

  if (variant === 0 || variant === 4) {
    message = varyCommercialWords(message, variant);
  } else if (variant === 1 || variant === 5) {
    message = varyGreeting(message, variant);
  } else if (variant === 2 || variant === 6) {
    message = varyLineBreaks(message, variant);
  } else {
    message = varyGreeting(varyCommercialWords(message, variant), variant);
  }

  message = cleanInlineText(message);

  if (base.length > 80 && message === base) {
    message = cleanInlineText(forceSafeVariation(base));
  }

  return message;
}
