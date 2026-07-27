import { buildConservativeRewriteCandidates } from "./conservative-rewriter";
import { normalizeBrazilianPortuguese } from "./grammar-normalizer";
import { renderCopyPlaceholders, buildPlaceholderContext } from "./placeholder-renderer";
import { extractSemanticBlocks } from "./pattern-detector";
import {
  calculateChangeScore,
  validateCommercialQuality,
  validateSemanticPreservation,
} from "./quality-validator";
import type {
  CopyDiversificationInput,
  CopyDiversificationOutput,
  CopyDiversificationResponse,
} from "./types";

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function inferLeadNameFromText(text: string) {
  const match =
    text.match(/\b(?:o|a)\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}\p{N}'&.\s-]{2,60}?)\s+foi\b/u) ??
    text.match(/\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}\p{N}'&.\s-]{2,60}?)\s+entrou\b/u);

  return match?.[1]?.trim() ?? "";
}

function inferCityFromText(text: string) {
  return (
    text.match(
      /\bProjeto\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}\s-]{2,50}?)(?=\s+(?:porque|pois|que|para|com)\b|[,.!?]|$)/u,
    )?.[1]?.trim() ?? ""
  );
}

function fallbackFormatting(original: string) {
  const protectedUrls: string[] = [];
  const protectedText = original.replace(/https?:\/\/\S+/gi, (url) => {
    const trailingPunctuation = url.match(/[.!?,;]+$/)?.[0] ?? "";
    const cleanUrl = trailingPunctuation ? url.slice(0, -trailingPunctuation.length) : url;
    const token = `URLPROTEGIDA${protectedUrls.length}`;

    protectedUrls.push(cleanUrl);
    return `${token}${trailingPunctuation}`;
  });
  const sentences = protectedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];

  if (sentences.length < 2) {
    return original;
  }

  return protectedUrls.reduce(
    (current, url, index) => current.replace(`URLPROTEGIDA${index}`, url),
    sentences.join("\n\n"),
  );
}

function scoreCandidate(
  original: string,
  candidate: string,
  input: CopyDiversificationInput,
  applied: string[],
  seed: number,
) {
  const context = buildPlaceholderContext(input);
  const blocks = extractSemanticBlocks(original, {
    city: context.city || inferCityFromText(original),
    leadName: input.lead ? context.company : inferLeadNameFromText(original),
    niche: input.niche || input.lead?.category || "",
  });
  const mode = input.mode ?? "funnel_step";
  const semantic = validateSemanticPreservation(original, candidate, blocks, mode);
  const commercialWarnings = validateCommercialQuality(candidate, mode);
  const changeScore = calculateChangeScore(original, candidate);
  const lengthRatio = original.length > 0 ? candidate.length / original.length : 1;
  const lengthPenalty = lengthRatio < 0.78 || lengthRatio > 1.3 ? 25 : 0;
  const warningPenalty = (semantic.warnings.length + commercialWarnings.length) * 7;
  const seedPreference = (hashText(candidate) + seed) % 7;
  const score =
    semantic.score * 2 +
    Math.min(changeScore, 45) -
    semantic.missingCriticalElements.length * 45 -
    warningPenalty -
    lengthPenalty +
    seedPreference;

  return {
    applied,
    changeScore,
    commercialWarnings,
    lengthRatio,
    message: candidate,
    score,
    semantic,
  };
}

export function diversifyCopy(input: CopyDiversificationInput): CopyDiversificationResponse {
  const context = buildPlaceholderContext(input);
  const original = normalizeBrazilianPortuguese(
    input.renderedText?.trim() || renderCopyPlaceholders(input.originalText, context),
  );
  const stableSeed = hashText(`${original}|${input.lead?.id ?? ""}`);
  const variantSeed =
    typeof input.variantSeed === "number"
      ? Math.max(0, input.variantSeed)
      : hashText(String(input.variantSeed ?? 1));
  const candidates = buildConservativeRewriteCandidates(original, stableSeed)
    .map((candidate) => scoreCandidate(original, candidate.message, input, candidate.applied, stableSeed))
    .filter(
      (candidate) =>
        candidate.semantic.missingCriticalElements.length === 0 &&
        candidate.semantic.score >= 82 &&
        candidate.semantic.warnings.length === 0 &&
        candidate.commercialWarnings.length === 0 &&
        candidate.lengthRatio >= 0.72 &&
        candidate.lengthRatio <= (original.length <= 60 ? 2.8 : 1.35) &&
        candidate.changeScore >= (original.length > 120 ? 14 : 7),
    )
    .sort((left, right) => right.score - left.score);
  const candidatePool = candidates.slice(0, 64);
  const chosen =
    candidatePool[variantSeed % Math.max(1, candidatePool.length)] ??
    scoreCandidate(
      original,
      normalizeBrazilianPortuguese(fallbackFormatting(original)),
      input,
      ["safe_paragraph_fallback"],
      stableSeed,
    );
  const contextBlocks = extractSemanticBlocks(original, {
    city: context.city || inferCityFromText(original),
    leadName: input.lead ? context.company : inferLeadNameFromText(original),
    niche: input.niche || input.lead?.category || "",
  });
  const warnings = [...chosen.semantic.warnings, ...chosen.commercialWarnings];

  if (chosen.changeScore < (original.length > 120 ? 14 : 7)) {
    warnings.push("A copy permite apenas uma variação sutil sem arriscar o significado.");
  }

  const preservedTriggers = contextBlocks.patterns
    .filter((pattern) => !chosen.semantic.missingCriticalElements.includes(pattern.text))
    .map((pattern) => pattern.type);

  return {
    message: chosen.message,
    stats: {
      changeScore: chosen.changeScore,
      detectedPatterns: contextBlocks.patterns,
      finalLength: chosen.message.length,
      modeUsed: "funnel_step",
      originalLength: original.length,
      preservedTriggers: Array.from(new Set(preservedTriggers)),
      reductionPercent:
        original.length > 0
          ? Math.round(((original.length - chosen.message.length) / original.length) * 100)
          : 0,
      semanticPreservationScore: chosen.semantic.score,
      transformationsApplied: chosen.applied,
      warnings,
    },
  } satisfies CopyDiversificationOutput;
}
