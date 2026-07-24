import { normalizeBrazilianPortuguese, enforceMaxLength } from "./grammar-normalizer";
import { renderCopyPlaceholders, buildPlaceholderContext } from "./placeholder-renderer";
import { applyContextualSynonyms } from "./phrase-rewriter";
import { extractSemanticBlocks } from "./pattern-detector";
import { rewriteByCommercialStructure } from "./sentence-restructurer";
import { calculateChangeScore, validateCommercialQuality, validateSemanticPreservation } from "./quality-validator";
import type { CopyDiversificationInput, CopyDiversificationOutput, CopyDiversificationResponse } from "./types";

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function uniqueByMessage(variations: CopyDiversificationOutput[]) {
  const seen = new Set<string>();

  return variations.filter((variation) => {
    const key = variation.message.toLowerCase().replace(/\s+/g, " ").trim();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function targetMaxLength(input: CopyDiversificationInput) {
  if (input.maxLength) {
    return input.maxLength;
  }

  if (input.mode === "funnel_step") {
    const stepName = (input.funnelStepName ?? "").toLowerCase();

    if (/primeiro|contato/.test(stepName)) return 80;
    if (/introdu/.test(stepName)) return 350;
    if (/explica/.test(stepName)) return 600;
    if (/autoridade/.test(stepName)) return 500;
    if (/escassez/.test(stepName)) return 400;
    if (/cta/.test(stepName)) return 250;
    if (/follow/.test(stepName)) return 320;
  }

  if (input.mode === "ultra_short") return 320;
  if (input.mode === "short_whatsapp") return 950;

  return undefined;
}

function inferLeadNameFromText(text: string) {
  const match =
    text.match(/\b(?:o|a)\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}\p{N}'&.\s-]{2,60}?)\s+foi\b/u) ??
    text.match(/\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}\p{N}'&.\s-]{2,60}?)\s+entrou\b/u);

  return match?.[1]?.trim() ?? "";
}

function inferCityFromText(text: string) {
  return text.match(/\bProjeto\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}\s-]{2,50})/u)?.[1]?.trim() ?? "";
}

function diversifyOne(input: CopyDiversificationInput, index = 0): CopyDiversificationOutput {
  const context = buildPlaceholderContext(input);
  const original = input.renderedText?.trim() || renderCopyPlaceholders(input.originalText, context);
  const seed = hashText(`${input.variantSeed ?? 1}|${index}|${original}|${input.lead?.id ?? ""}`);
  const blocks = extractSemanticBlocks(original, {
    city: context.city || inferCityFromText(original),
    leadName: input.lead ? context.company : inferLeadNameFromText(original),
    niche: input.niche || input.lead?.category || "",
  });
  const structural = rewriteByCommercialStructure({
    blocks,
    mode: input.mode,
    original,
    seed,
    stepName: input.funnelStepName,
  });
  const synonymized = input.mode === "funnel_step" && original.length <= 120
    ? { applied: [], text: structural.text }
    : applyContextualSynonyms(structural.text, seed);
  const maxLength = targetMaxLength(input);
  let message = normalizeBrazilianPortuguese(enforceMaxLength(synonymized.text, maxLength));
  let changeScore = calculateChangeScore(original, message);
  const minChange = input.minChangeScore ?? (original.length > 160 ? 35 : 16);

  if (changeScore < minChange && original.length > 80) {
    const withBreak = normalizeBrazilianPortuguese(message.replace(/([.!?])\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/u, "$1\n\n$2"));

    if (withBreak !== message) {
      message = withBreak;
      changeScore = calculateChangeScore(original, message);
      structural.applied.push("line_break_variation");
    }
  }

  const semantic = validateSemanticPreservation(original, message, blocks, input.mode);

  if (semantic.score < 72 && input.preserveMeaning !== false) {
    message = normalizeBrazilianPortuguese(original);
    changeScore = calculateChangeScore(original, message);
    structural.applied.push("semantic_fallback");
  }

  const finalSemantic = validateSemanticPreservation(original, message, blocks, input.mode);
  const commercialWarnings = validateCommercialQuality(message, input.mode);
  const transformationsApplied = Array.from(new Set([...structural.applied, ...synonymized.applied]));
  const warnings = [...finalSemantic.warnings, ...commercialWarnings];
  const preservedTriggers = blocks.patterns
    .filter((pattern) => !finalSemantic.missingCriticalElements.includes(pattern.text))
    .map((pattern) => pattern.type);

  if (changeScore < minChange) {
    warnings.push("Variação abaixo do nível mínimo de diferença.");
  }

  return {
    message,
    stats: {
      changeScore,
      detectedPatterns: blocks.patterns,
      finalLength: message.length,
      modeUsed: input.mode,
      originalLength: original.length,
      preservedTriggers: Array.from(new Set(preservedTriggers)),
      reductionPercent: original.length > 0 ? Math.max(0, Math.round(((original.length - message.length) / original.length) * 100)) : 0,
      semanticPreservationScore: finalSemantic.score,
      transformationsApplied,
      warnings,
    },
  };
}

export function diversifyCopy(input: CopyDiversificationInput): CopyDiversificationResponse {
  const count = Math.max(1, Math.min(5, input.count ?? 1));
  const attempts = Array.from({ length: count * 3 }, (_, index) => diversifyOne(input, index));
  const variations = uniqueByMessage(attempts)
    .sort((a, b) => {
      const aScore = a.stats.semanticPreservationScore + a.stats.changeScore - a.stats.warnings.length * 5;
      const bScore = b.stats.semanticPreservationScore + b.stats.changeScore - b.stats.warnings.length * 5;

      return bScore - aScore;
    })
    .slice(0, count);
  const primary = variations[0] ?? diversifyOne(input, 0);

  if (variations.length < count) {
    primary.stats.warnings.push("Não foi possível gerar todas as variações únicas solicitadas.");
  }

  return {
    ...primary,
    variations,
  };
}
