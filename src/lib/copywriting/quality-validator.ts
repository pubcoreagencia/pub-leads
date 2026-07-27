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

function meaningfulTokens(text: string) {
  return normalizeCopyText(text)
    .split(" ")
    .filter((token) => token.length > 3 && !stopwords.has(token));
}

function uniqueMatches(text: string, pattern: RegExp) {
  return Array.from(new Set(text.match(pattern) ?? [])).map((value) => value.trim());
}

function protectedLiterals(text: string, blocks: SemanticBlocks) {
  return Array.from(
    new Set(
      [
        ...blocks.numbers,
        ...blocks.prices,
        blocks.leadName,
        blocks.city,
        blocks.deadline ?? "",
        ...blocks.authorityNames,
        ...uniqueMatches(text, /https?:\/\/\S+/gi).map((value) => value.replace(/[).,;]+$/, "")),
        ...uniqueMatches(text, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi),
      ].filter(Boolean),
    ),
  );
}

function exactSet(values: string[]) {
  return new Set(values.map((value) => normalizeCopyText(value)));
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

  const paragraphChanged = original.replace(/\r\n/g, "\n").split(/\n{2,}/).length !== diversified.replace(/\r\n/g, "\n").split(/\n{2,}/).length;

  return Math.max(0, Math.min(100, tokenDistance + lengthDelta + (orderChanged ? 20 : 0) + (paragraphChanged ? 8 : 0)));
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
  const originalTokens = meaningfulTokens(original);
  const diversifiedTokens = new Set(meaningfulTokens(diversified));
  const retainedTokens = originalTokens.filter((token) => diversifiedTokens.has(token)).length;
  const lexicalCoverage = originalTokens.length > 0 ? retainedTokens / originalTokens.length : 1;
  const minimumLexicalCoverage = original.length <= 180 ? 0.3 : 0.45;
  const targetLexicalCoverage = original.length <= 180 ? 0.52 : 0.7;

  for (const literal of protectedLiterals(original, blocks)) {
    if (!normalized.includes(normalizeCopyText(literal))) {
      missingCriticalElements.push(literal);
    }
  }

  for (const url of uniqueMatches(original, /https?:\/\/\S+/gi).map((value) => value.replace(/[).,;]+$/, ""))) {
    if (!diversified.includes(url)) {
      missingCriticalElements.push(`url:${url}`);
    }
  }

  for (const email of uniqueMatches(original, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi)) {
    if (!diversified.includes(email)) {
      missingCriticalElements.push(`email:${email}`);
    }
  }

  if (/ag[eê]ncia pub/i.test(original) && !/ag[eê]ncia pub/i.test(diversified)) {
    missingCriticalElements.push("Agência PUB");
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

  if (lexicalCoverage < minimumLexicalCoverage) {
    warnings.push("A versão perdeu partes relevantes da copy original.");
  }

  const originalNumbers = exactSet(uniqueMatches(original, /\b\d+(?:[.,]\d+)?(?:\s*(?:a|e|-)\s*\d+)?\b/g));
  const diversifiedNumbers = exactSet(uniqueMatches(diversified, /\b\d+(?:[.,]\d+)?(?:\s*(?:a|e|-)\s*\d+)?\b/g));

  for (const number of diversifiedNumbers) {
    if (!originalNumbers.has(number)) {
      missingCriticalElements.push(`numero_inventado:${number}`);
    }
  }

  if (mode === "funnel_step" && original.length <= 90 && diversified.length > 120) {
    warnings.push("Passo curto ficou longo demais.");
  }

  const coveragePenalty = Math.round(Math.max(0, targetLexicalCoverage - lexicalCoverage) * 38);
  const score = Math.max(0, 100 - missingCriticalElements.length * 18 - warnings.length * 8 - coveragePenalty);

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
