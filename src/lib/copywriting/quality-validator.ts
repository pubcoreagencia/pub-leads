import type { SemanticBlocks } from "./semantic-blocks";
import { normalizeCopyText } from "./semantic-blocks";
import type { CopyDiversificationMode, SemanticValidationResult } from "./types";

const stopwords = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "por",
  "com",
  "que",
  "um",
  "uma",
  "no",
  "na",
  "nos",
  "nas",
  "vocês",
  "voce",
  "te",
]);

function tokenSet(text: string) {
  return new Set(
    normalizeCopyText(text)
      .split(" ")
      .filter((token) => token.length > 2 && !stopwords.has(token)),
  );
}

export function calculateChangeScore(original: string, diversified: string) {
  const originalTokens = tokenSet(original);
  const diversifiedTokens = tokenSet(diversified);
  const intersection = Array.from(originalTokens).filter((token) => diversifiedTokens.has(token)).length;
  const union = new Set([...originalTokens, ...diversifiedTokens]).size || 1;
  const tokenDistance = Math.round((1 - intersection / union) * 55);
  const originalSentences = normalizeCopyText(original).split(/\b(?:e|mas|porque|pois)\b|[.!?]+/).filter(Boolean);
  const diversifiedSentences = normalizeCopyText(diversified).split(/\b(?:e|mas|porque|pois)\b|[.!?]+/).filter(Boolean);
  const orderChanged = originalSentences.some((sentence, index) => sentence.trim() !== diversifiedSentences[index]?.trim());
  const lengthDelta = original.length > 0 ? Math.min(20, Math.round(Math.abs(original.length - diversified.length) / original.length * 100)) : 0;

  return Math.max(0, Math.min(100, tokenDistance + lengthDelta + (orderChanged ? 25 : 0)));
}

export function validateSemanticPreservation(
  original: string,
  diversified: string,
  blocks: SemanticBlocks,
  mode: CopyDiversificationMode,
): SemanticValidationResult {
  const normalized = normalizeCopyText(diversified);
  const missingCriticalElements: string[] = [];
  const warnings: string[] = [];

  for (const number of blocks.numbers) {
    if (!normalized.includes(normalizeCopyText(number))) {
      missingCriticalElements.push(`numero:${number}`);
    }
  }

  for (const price of blocks.prices) {
    if (!normalized.includes(normalizeCopyText(price))) {
      missingCriticalElements.push(`valor:${price}`);
    }
  }

  for (const url of original.match(/https?:\/\/\S+/gi) ?? []) {
    if (!diversified.includes(url.replace(/[).,;]+$/, ""))) {
      missingCriticalElements.push(`url:${url}`);
    }
  }

  if (/ag[eê]ncia pub/i.test(original) && !/ag[eê]ncia pub/i.test(diversified)) {
    missingCriticalElements.push("Agência PUB");
  }

  for (const term of [blocks.leadName, blocks.city, blocks.deadline ?? "", ...blocks.authorityNames]) {
    if (term && !normalized.includes(normalizeCopyText(term))) {
      missingCriticalElements.push(term);
    }
  }

  for (const item of blocks.deliveryItems) {
    if (!normalized.includes(normalizeCopyText(item))) {
      missingCriticalElements.push(`entrega:${item}`);
    }
  }

  for (const term of ["valores", "detalhes", "entrega"]) {
    if (normalizeCopyText(original).includes(term) && !normalized.includes(term)) {
      missingCriticalElements.push(term);
    }
  }

  if (blocks.hasQuestion && !/\?/.test(diversified) && !mode.includes("ultra")) {
    warnings.push("CTA/pergunta ausente.");
  }

  if (mode === "funnel_step" && original.length <= 90 && diversified.length > 120) {
    warnings.push("Passo curto ficou longo demais.");
  }

  const score = Math.max(0, 100 - missingCriticalElements.length * 14 - warnings.length * 6);

  return { missingCriticalElements, score, warnings };
}

export function validateCommercialQuality(message: string, mode: CopyDiversificationMode) {
  const warnings: string[] = [];

  if (/solu[cç][oõ]es inovadoras|alavancar resultados|sinergia/i.test(message)) {
    warnings.push("Linguagem generica/corporativa detectada.");
  }

  if (message.length > 950 && mode === "short_whatsapp") {
    warnings.push("Mensagem longa para WhatsApp curto.");
  }

  if (!/[.!?]$/.test(message) && !/https?:\/\/\S+\/?$/.test(message.trim())) {
    warnings.push("Pontuacao final ausente.");
  }

  return warnings;
}
