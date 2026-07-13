import type { Lead } from "@/schemas/lead";

export type DiversificationMode = "short_whatsapp" | "balanced" | "high_variation" | "ultra_short";

export type DiversifyBaseCopyInput = {
  baseCopy?: string;
  city?: string | null;
  copyBase?: string;
  lead?: Lead;
  leadName?: string | null;
  mode?: DiversificationMode;
  niche?: string | null;
  variantSeed?: number;
};

export type DiversificationStats = {
  finalLength: number;
  originalLength: number;
  preservedTriggers: string[];
  reductionPercent: number;
  transformationsApplied: number;
  warnings: string[];
};

export type DiversificationReport = {
  diversificationScore: number;
  identicalParagraphRatio: number;
  message: string;
  originalWithPlaceholders: string;
  placeholdersRemaining: string[];
  protectedTermsMissing: string[];
  sentenceChanges: number;
  stats: DiversificationStats;
  transformationsApplied: number;
};

type CommercialBlocks = {
  authorityBrands: string[];
  city: string;
  competitor: boolean;
  deliveryItems: string[];
  hasAuthority: boolean;
  hasCta: boolean;
  hasOpportunity: boolean;
  hasScarcity: boolean;
  hasSelection: boolean;
  leadName: string;
  niche: string;
  projectName: string;
  scarcityCount: string | null;
  deadline: string | null;
};

const authorityNames = [
  "L'Oréal Paris",
  "L'Oreal Paris",
  "Globosat",
  "Circo Voador",
  "Gabriel Pensador",
  "Diogo Defante",
  "Paulinho Serra",
];

const deliveryCatalog = [
  { aliases: [/site\s+(?:estruturado|profissional)/i, /\bsite\b/i], label: "site profissional" },
  { aliases: [/instagram\s+profissional/i, /\bInstagram\b/i], label: "Instagram profissional" },
  { aliases: [/Google\s+Meu\s+Neg[oó]cio/i], label: "Google Meu Negócio" },
  { aliases: [/e-?mail\s+corporativo/i], label: "e-mail corporativo" },
  { aliases: [/WhatsApp\s+Business/i], label: "WhatsApp Business" },
];

const openings = [
  "Oi, tudo bem?",
  "Olá, tudo certo?",
  "Oi! Tudo bem por aí?",
  "Olá, como vai?",
];

const selectionTemplates = [
  (b: CommercialBlocks) =>
    `A ${b.leadName} foi uma das ${b.scarcityCount ?? "poucas empresas"} de ${b.niche} selecionadas para o ${b.projectName}.`,
  (b: CommercialBlocks) =>
    `Selecionamos a ${b.leadName} entre ${b.scarcityCount ?? "poucas empresas"} de ${b.niche} para o ${b.projectName}.`,
  (b: CommercialBlocks) =>
    `A ${b.leadName} entrou na primeira lista de empresas escolhidas para o ${b.projectName}, com foco em ${b.niche}.`,
  (b: CommercialBlocks) =>
    `${b.leadName} está entre as empresas de ${b.niche} escolhidas para o ${b.projectName}.`,
];

const opportunityTemplates = [
  "A ideia é estruturar negócios já consolidados, mas que ainda não têm uma presença digital no nível que merecem.",
  "O projeto é voltado para empresas que já têm valor no mercado, mas ainda podem evoluir muito na presença digital.",
  "Buscamos negócios com boa base, mas que ainda não estão posicionados digitalmente como poderiam.",
  "É uma oportunidade para negócios fortes ganharem uma estrutura digital mais profissional.",
];

const deliveryTemplates = [
  (items: string) => `A entrega inclui ${items}.`,
  (items: string) => `Na prática, entregamos ${items}.`,
  (items: string) => `A estrutura contempla ${items}.`,
  (items: string) => `O pacote reúne ${items}.`,
];

const deadlineTemplates = [
  (deadline: string) => `Tudo pronto em ${deadline}.`,
  (deadline: string) => `A estrutura fica pronta em ${deadline}.`,
  (deadline: string) => `A entrega acontece em ${deadline}.`,
  (deadline: string) => `O prazo de entrega é de ${deadline}.`,
];

const authorityTemplates = [
  (brands: string) => `A estrutura é feita pela Agência PUB, que já atuou com nomes como ${brands}.`,
  (brands: string) => `O projeto é conduzido pela Agência PUB, com histórico junto a marcas e nomes como ${brands}.`,
  (brands: string) => `Quem conduz é a Agência PUB, que já trabalhou com marcas, empresas e artistas como ${brands}.`,
  (brands: string) => `Por trás está a Agência PUB, com experiência em projetos ligados a ${brands}.`,
];

const scarcityTemplates = [
  "Como são poucas vagas, se não fizer sentido, seguimos para a próxima empresa da lista",
  "Se vocês não quiserem avançar, a vaga segue para outra empresa selecionada",
  "Caso não faça sentido agora, liberamos a vaga para a próxima empresa da lista",
  "Como a lista é limitada, se não avançarmos com vocês, chamamos a próxima empresa",
];

const competitorTemplates = [
  "possivelmente um concorrente direto.",
  "com chance de ser um concorrente direto.",
  "provavelmente alguém do mesmo mercado.",
  "talvez uma empresa que dispute o mesmo público.",
];

const ctaTemplates = [
  "Gostaríamos muito que fossem vocês. Posso te passar os detalhes?",
  "A ideia é avançar com vocês. Faz sentido eu te explicar melhor?",
  "Gostaria muito que essa vaga ficasse com vocês. Quer que eu te envie as informações?",
  "Se fizer sentido, posso te mostrar como funcionaria?",
];

function normalizeForCompare(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanInlineText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function listToText(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function pick<T>(items: T[], seed: number, offset = 0) {
  return items[(seed + offset) % items.length];
}

function leadCompany(lead: Lead | undefined, explicitLeadName?: string | null) {
  return (
    explicitLeadName?.trim() ||
    lead?.company ||
    lead?.business_name ||
    lead?.fantasy_name ||
    lead?.name ||
    "sua empresa"
  );
}

function leadPhone(lead: Lead | undefined) {
  return lead?.whatsapp || lead?.phone || lead?.phone_2 || "";
}

function replaceAllPatterns(value: string, patterns: RegExp[], replacement: string) {
  return patterns.reduce((current, pattern) => current.replace(pattern, replacement), value);
}

function fixBasicGrammar(value: string, leadName: string) {
  let next = value;

  if (leadName && leadName !== "sua empresa") {
    const escaped = leadName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(
      new RegExp(`a\\s+${escaped}\\s+foram\\s+uma\\s+das\\s+empresas\\s+selecionadas`, "gi"),
      `A ${leadName} foi uma das empresas selecionadas`,
    );
    next = next.replace(
      new RegExp(`a\\s+empresa\\s+${escaped}\\s+foram`, "gi"),
      `a empresa ${leadName} foi`,
    );
  }

  return next
    .replace(/\bforam uma das empresas selecionadas\b/gi, "foi uma das empresas selecionadas")
    .replace(/\bVocês foi\b/gi, "Vocês foram");
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

  message = replaceAllPatterns(message, [/\{cidade\}/gi, /\[CIDADE\]/gi, /\bCIDADE\b/g], city);
  message = replaceAllPatterns(
    message,
    [/\{nicho\}/gi, /\[NICHO\]/gi, /\bNICHO\b/g, /\{copy\}/gi, /\[COPY\]/gi, /\bCOPY\b/g],
    niche,
  );
  message = replaceAllPatterns(
    message,
    [/\{lead\}/gi, /\[LEAD\]/gi, /\bLEAD\b/g, /\{empresa\}/gi, /\[EMPRESA\]/gi, /\bEMPRESA\b/g],
    leadDisplayName,
  );
  message = replaceAllPatterns(message, [/\{nome\}/gi], lead?.name || leadDisplayName);
  message = replaceAllPatterns(message, [/\{telefone\}/gi], phone);
  message = replaceAllPatterns(message, [/\{site\}/gi], site);

  return {
    city,
    leadDisplayName,
    niche,
    text: cleanInlineText(fixBasicGrammar(message, leadDisplayName)),
  };
}

function extractScarcityCount(text: string) {
  const match =
    text.match(/(?:apenas|somente|s[oó])\s+(\d+)\s+empresas/i) ??
    text.match(/\b(\d+)\s+empresas\b/i);

  return match?.[1] ? `${match[1]} empresas` : null;
}

function extractDeadline(text: string) {
  const match =
    text.match(/\b(\d+\s*(?:a|e|-)\s*\d+\s+dias)\b/i) ??
    text.match(/\b(\d+\s+dias)\b/i);

  if (!match?.[1]) {
    return null;
  }

  return match[1].replace(/\s*-\s*/g, " a ").replace(/\s+/g, " ");
}

function extractDeliveryItems(text: string) {
  const normalized = normalizeForCompare(text);
  const items = deliveryCatalog
    .filter((item) => {
      if (item.aliases.some((pattern) => pattern.test(text))) {
        return true;
      }

      if (item.label === "site profissional") {
        return normalized.includes("site");
      }

      if (item.label === "Instagram profissional") {
        return normalized.includes("instagram");
      }

      if (item.label === "Google Meu Negócio") {
        return normalized.includes("google meu negocio") || normalized.includes("google meu neg");
      }

      if (item.label === "e-mail corporativo") {
        return normalized.includes("e mail corporativo") || normalized.includes("email corporativo");
      }

      if (item.label === "WhatsApp Business") {
        return normalized.includes("whatsapp business");
      }

      return false;
    })
    .map((item) => item.label);

  return Array.from(new Set(items));
}

function extractAuthorityBrands(text: string) {
  const normalizedText = normalizeForCompare(text);
  const brands = authorityNames.filter((brand) => normalizedText.includes(normalizeForCompare(brand)));
  const likelyContainsLOreal = /L.?Or.{1,3}al\s+Paris/i.test(text) || normalizedText.includes("l oreal paris");

  if (likelyContainsLOreal && !brands.includes("L'Oréal Paris")) {
    brands.unshift("L'Oréal Paris");
  }

  const uniqueBrands = Array.from(new Set(brands.map((brand) => (brand === "L'Oreal Paris" ? "L'Oréal Paris" : brand))));

  return uniqueBrands.slice(0, 6);
}

function extractBlocks(text: string, leadName: string, city: string, niche: string): CommercialBlocks {
  const deliveryItems = extractDeliveryItems(text);
  const authorityBrands = extractAuthorityBrands(text);
  const deadline = extractDeadline(text);
  const scarcityCount = extractScarcityCount(text);

  return {
    authorityBrands,
    city,
    competitor: /concorrente|mesmo mercado|disputa/i.test(text),
    deliveryItems,
    hasAuthority: /ag[eê]ncia\s+pub/i.test(text) || authorityBrands.length > 0,
    hasCta: /\?\s*$/.test(text) || /posso|quer que|faz sentido|te enviar|explicar/i.test(text),
    hasOpportunity: /presen[cç]a digital|estruturad|nível|nivel|consolidad|potencial|merece/i.test(text),
    hasScarcity: Boolean(scarcityCount) || /poucas vagas|vaga|lista|pr[oó]xima empresa/i.test(text),
    hasSelection: /selecion|escolhid|entrevista|projeto|primeira lista/i.test(text),
    leadName,
    niche: niche || "negócios locais",
    projectName: city ? `Projeto ${city}` : "projeto",
    scarcityCount,
    deadline,
  };
}

function buildCompactMessage(blocks: CommercialBlocks, seed: number, mode: DiversificationMode) {
  const applied: string[] = ["placeholder_replacement", "commercial_extraction", "compression"];
  const paragraphs: string[] = [];
  const shouldUseUltraShort = mode === "ultra_short";

  paragraphs.push(pick(openings, seed));
  applied.push("opening_variation");

  if (blocks.hasSelection || blocks.city || blocks.niche) {
    paragraphs.push(pick(selectionTemplates, seed, 1)(blocks));
    applied.push("selection_block");
  }

  if (blocks.hasOpportunity && !shouldUseUltraShort) {
    paragraphs.push(pick(opportunityTemplates, seed, 2));
    applied.push("opportunity_block");
  }

  if (blocks.deliveryItems.length > 0) {
    const delivery = pick(deliveryTemplates, seed, 3)(listToText(blocks.deliveryItems));
    const deadline = blocks.deadline ? ` ${pick(deadlineTemplates, seed, 4)(blocks.deadline)}` : "";
    paragraphs.push(`${delivery}${deadline}`);
    applied.push("delivery_block");

    if (blocks.deadline) {
      applied.push("deadline_preserved");
    }
  }

  if (blocks.hasAuthority) {
    const brands = blocks.authorityBrands.length > 0
      ? listToText(blocks.authorityBrands)
      : "marcas e nomes relevantes";
    paragraphs.push(pick(authorityTemplates, seed, 5)(brands));
    applied.push("authority_block");
  }

  if (blocks.hasScarcity || blocks.competitor) {
    const scarcity = pick(scarcityTemplates, seed, 6);
    const competitor = blocks.competitor ? ` — ${pick(competitorTemplates, seed, 7)}` : ".";
    paragraphs.push(`${scarcity}${competitor}`);
    applied.push("scarcity_block");

    if (blocks.competitor) {
      applied.push("competitor_preserved");
    }
  }

  paragraphs.push(pick(ctaTemplates, seed, 8));
  applied.push("cta_block");

  if (mode === "balanced") {
    paragraphs.splice(
      2,
      0,
      "O contato é justamente porque enxergamos potencial no que vocês já vêm construindo.",
    );
    applied.push("balanced_context");
  }

  if (mode === "high_variation" && paragraphs.length > 4) {
    const cta = paragraphs.pop();
    const authorityIndex = paragraphs.findIndex((paragraph) => /Agência PUB/.test(paragraph));

    if (cta && authorityIndex > 2) {
      const [authority] = paragraphs.splice(authorityIndex, 1);
      paragraphs.splice(2, 0, authority);
      applied.push("block_reorder");
    }

    if (cta) {
      paragraphs.push(cta);
    }
  }

  return {
    applied,
    message: cleanInlineText(paragraphs.join("\n\n")),
  };
}

function buildAggressiveFallback(blocks: CommercialBlocks, seed: number) {
  const items = blocks.deliveryItems.length > 0
    ? listToText(blocks.deliveryItems)
    : "site profissional, Instagram, Google Meu Negócio, e-mail corporativo e WhatsApp Business";
  const deadline = blocks.deadline ? ` em ${blocks.deadline}` : "";
  const brands = blocks.authorityBrands.length > 0 ? listToText(blocks.authorityBrands.slice(0, 5)) : "nomes relevantes";
  const scarcity = blocks.scarcityCount ?? "poucas empresas";
  const competitor = blocks.competitor ? " — possivelmente um concorrente direto." : ".";
  const cta = pick(ctaTemplates, seed, 9);

  return cleanInlineText(
    [
      pick(openings, seed, 10),
      `A ${blocks.leadName} foi uma das ${scarcity} de ${blocks.niche} selecionadas para o ${blocks.projectName}.`,
      `A proposta é estruturar a presença digital com ${items}${deadline}.`,
      `Tudo conduzido pela Agência PUB, que já atuou com ${brands}.`,
      `Se não fizer sentido, seguimos para a próxima empresa da lista${competitor}`,
      cta,
    ].join("\n\n"),
  );
}

function findRemainingPlaceholders(value: string) {
  const matches =
    value.match(
      /\[(?:CIDADE|NICHO|COPY|LEAD|EMPRESA)\]|\{(?:cidade|CIDADE|nicho|NICHO|copy|COPY|lead|LEAD|empresa|EMPRESA)\}|\b(?:CIDADE|NICHO|COPY|LEAD|EMPRESA)\b/g,
    ) ?? [];

  return Array.from(new Set(matches));
}

function splitSentences(paragraph: string) {
  return paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()) ?? [];
}

function countChangedSentences(original: string, diversified: string) {
  const originalSentences = splitSentences(original.replace(/\n+/g, " "));
  const diversifiedSentences = splitSentences(diversified.replace(/\n+/g, " "));
  const maxLength = Math.max(originalSentences.length, diversifiedSentences.length);
  let changed = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if (normalizeForCompare(originalSentences[index] ?? "") !== normalizeForCompare(diversifiedSentences[index] ?? "")) {
      changed += 1;
    }
  }

  return changed;
}

function identicalParagraphRatio(original: string, diversified: string) {
  const originalParagraphs = original.split(/\n{2,}/).map(normalizeForCompare).filter(Boolean);
  const diversifiedParagraphs = diversified.split(/\n{2,}/).map(normalizeForCompare).filter(Boolean);

  if (originalParagraphs.length === 0) {
    return 0;
  }

  const identical = originalParagraphs.filter(
    (paragraph, index) => paragraph === (diversifiedParagraphs[index] ?? ""),
  ).length;

  return identical / originalParagraphs.length;
}

function getProtectedTriggers(blocks: CommercialBlocks, message: string) {
  const normalized = normalizeForCompare(message);
  const triggers: string[] = [];

  if (blocks.hasSelection && /selecion|escolhid|primeira lista/.test(normalized)) {
    triggers.push("seleção");
  }

  if (blocks.hasScarcity && /poucas|vaga|lista|limitada|5 empresas/.test(normalized)) {
    triggers.push("escassez");
  }

  if (blocks.hasAuthority && /agencia pub|l'oreal|globosat|circo voador|gabriel pensador|diogo defante|paulinho serra/.test(normalized)) {
    triggers.push("autoridade");
  }

  if (blocks.deliveryItems.length > 0 && blocks.deliveryItems.some((item) => normalized.includes(normalizeForCompare(item)))) {
    triggers.push("entrega");
  }

  if (blocks.deadline && normalized.includes(normalizeForCompare(blocks.deadline))) {
    triggers.push("prazo");
  }

  if (blocks.competitor && /concorrente|mesmo mercado|dispute o mesmo/.test(normalized)) {
    triggers.push("concorrente");
  }

  if (/\?/.test(message)) {
    triggers.push("CTA");
  }

  return triggers;
}

function getProtectedTermsMissing(blocks: CommercialBlocks, message: string) {
  const normalized = normalizeForCompare(message);
  const terms = [
    blocks.leadName,
    blocks.city,
    blocks.niche,
    blocks.scarcityCount ?? "",
    blocks.deadline ?? "",
    blocks.hasAuthority ? "Agência PUB" : "",
    ...blocks.deliveryItems,
  ].filter(Boolean);

  return Array.from(new Set(terms)).filter((term) => !normalized.includes(normalizeForCompare(term)));
}

function buildWarnings(blocks: CommercialBlocks, message: string, stats: Omit<DiversificationStats, "warnings">) {
  const warnings: string[] = [];
  const placeholders = findRemainingPlaceholders(message);

  if (placeholders.length > 0) {
    warnings.push(`Placeholders pendentes: ${placeholders.join(", ")}`);
  }

  if (stats.originalLength > 1000 && stats.finalLength > 950) {
    warnings.push("Mensagem acima de 950 caracteres.");
  }

  if (stats.originalLength > 1000 && stats.reductionPercent < 35) {
    warnings.push("Redução abaixo de 35%.");
  }

  if (stats.preservedTriggers.length < 4) {
    warnings.push("Poucos gatilhos preservados.");
  }

  if (!/\?/.test(message)) {
    warnings.push("CTA ausente.");
  }

  if (blocks.city && !normalizeForCompare(message).includes(normalizeForCompare(blocks.city))) {
    warnings.push("Cidade ausente.");
  }

  if (blocks.niche && !normalizeForCompare(message).includes(normalizeForCompare(blocks.niche))) {
    warnings.push("Nicho ausente.");
  }

  return warnings;
}

function shouldFallback(original: string, message: string, stats: Omit<DiversificationStats, "warnings">) {
  if (normalizeForCompare(original) === normalizeForCompare(message)) {
    return true;
  }

  if (original.length > 1000) {
    return stats.finalLength > 950 || stats.reductionPercent < 35 || stats.preservedTriggers.length < 4;
  }

  return original.length > 80 && countChangedSentences(original, message) === 0;
}

export function calculateDiversificationScore(
  original: string,
  diversified: string,
  transformationsApplied = 0,
) {
  const sentenceChanges = countChangedSentences(original, diversified);
  const paragraphRatio = identicalParagraphRatio(original, diversified);
  const placeholdersRemaining = findRemainingPlaceholders(diversified);
  const reduction = original.length > 0 ? Math.round(((original.length - diversified.length) / original.length) * 100) : 0;
  let score = 0;

  score += Math.min(sentenceChanges * 7, 28);
  score += Math.min(transformationsApplied * 5, 30);
  score += Math.max(0, Math.min(reduction, 40));
  score += Math.round((1 - paragraphRatio) * 15);

  if (placeholdersRemaining.length === 0) {
    score += 10;
  }

  if (/\?/.test(diversified)) {
    score += 8;
  }

  return {
    diversificationScore: Math.max(0, Math.min(100, score)),
    identicalParagraphRatio: paragraphRatio,
    placeholdersRemaining,
    protectedTermsMissing: [],
    sentenceChanges,
  };
}

export function diversifyBaseCopyWithReport(input: DiversifyBaseCopyInput): DiversificationReport {
  const placeholderResult = replacePlaceholders(input);
  const seedSource = [
    input.variantSeed ?? 0,
    input.lead?.id,
    input.lead?.name,
    input.leadName,
    input.baseCopy ?? input.copyBase,
  ]
    .filter(Boolean)
    .join("|");
  const seed = hashText(seedSource);
  const mode = input.mode ?? "short_whatsapp";
  const blocks = extractBlocks(
    placeholderResult.text,
    placeholderResult.leadDisplayName,
    placeholderResult.city,
    placeholderResult.niche,
  );
  let result = buildCompactMessage(blocks, seed, mode);
  let preservedTriggers = getProtectedTriggers(blocks, result.message);
  let provisionalStats = {
    finalLength: result.message.length,
    originalLength: placeholderResult.text.length,
    preservedTriggers,
    reductionPercent: placeholderResult.text.length > 0
      ? Math.max(0, Math.round(((placeholderResult.text.length - result.message.length) / placeholderResult.text.length) * 100))
      : 0,
    transformationsApplied: result.applied.length,
  };

  if (shouldFallback(placeholderResult.text, result.message, provisionalStats)) {
    result = {
      applied: [...result.applied, "compact_fallback"],
      message: buildAggressiveFallback(blocks, seed),
    };
    preservedTriggers = getProtectedTriggers(blocks, result.message);
    provisionalStats = {
      finalLength: result.message.length,
      originalLength: placeholderResult.text.length,
      preservedTriggers,
      reductionPercent: placeholderResult.text.length > 0
        ? Math.max(0, Math.round(((placeholderResult.text.length - result.message.length) / placeholderResult.text.length) * 100))
        : 0,
      transformationsApplied: result.applied.length,
    };
  }

  const quality = calculateDiversificationScore(
    placeholderResult.text,
    result.message,
    result.applied.length,
  );
  const protectedTermsMissing = getProtectedTermsMissing(blocks, result.message);
  const stats: DiversificationStats = {
    ...provisionalStats,
    warnings: buildWarnings(blocks, result.message, provisionalStats),
  };

  return {
    ...quality,
    diversificationScore: Math.min(100, quality.diversificationScore + preservedTriggers.length * 3),
    message: result.message,
    originalWithPlaceholders: placeholderResult.text,
    protectedTermsMissing,
    stats,
    transformationsApplied: result.applied.length,
  };
}

export function diversifyBaseCopy(input: DiversifyBaseCopyInput) {
  return diversifyBaseCopyWithReport(input).message;
}
