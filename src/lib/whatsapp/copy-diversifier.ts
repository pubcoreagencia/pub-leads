import type { Lead } from "@/schemas/lead";
import { calculateChangeScore, diversifyCopy } from "@/src/lib/copywriting";
import type { CopyDiversificationMode } from "@/src/lib/copywriting";

export type DiversificationMode = CopyDiversificationMode;

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

export function calculateDiversificationScore(original: string, diversified: string, transformationsApplied = 0) {
  const changeScore = calculateChangeScore(original, diversified);

  return {
    diversificationScore: Math.min(100, changeScore + transformationsApplied * 3),
    identicalParagraphRatio: changeScore >= 35 ? 0 : 1,
    placeholdersRemaining: diversified.match(/\{[a-zA-Z_]+\}|\[[A-Z_]+\]/g) ?? [],
    protectedTermsMissing: [],
    sentenceChanges: changeScore >= 35 ? 1 : 0,
  };
}

export function diversifyBaseCopyWithReport(input: DiversifyBaseCopyInput): DiversificationReport {
  const originalText = input.baseCopy ?? input.copyBase ?? "";
  const output = diversifyCopy({
    city: input.city,
    lead: input.lead,
    mode: input.mode ?? "short_whatsapp",
    niche: input.niche,
    originalText,
    variantSeed: input.variantSeed,
  });

  return {
    diversificationScore: output.stats.changeScore,
    identicalParagraphRatio: output.stats.changeScore >= 35 ? 0 : 1,
    message: output.message,
    originalWithPlaceholders: originalText,
    placeholdersRemaining: output.message.match(/\{[a-zA-Z_]+\}|\[[A-Z_]+\]/g) ?? [],
    protectedTermsMissing: output.stats.semanticPreservationScore < 80 ? output.stats.warnings : [],
    sentenceChanges: output.stats.changeScore >= 35 ? 1 : 0,
    stats: {
      finalLength: output.stats.finalLength,
      originalLength: output.stats.originalLength,
      preservedTriggers: output.stats.preservedTriggers,
      reductionPercent: output.stats.reductionPercent,
      transformationsApplied: output.stats.transformationsApplied.length,
      warnings: output.stats.warnings,
    },
    transformationsApplied: output.stats.transformationsApplied.length,
  };
}

export function diversifyBaseCopy(input: DiversifyBaseCopyInput) {
  return diversifyBaseCopyWithReport(input).message;
}
