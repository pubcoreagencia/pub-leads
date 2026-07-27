import type { Lead } from "@/schemas/lead";

export type CopyDiversificationMode =
  | "short_whatsapp"
  | "balanced"
  | "high_variation"
  | "funnel_step"
  | "ultra_short"
  | "same_strength";

export type RewritePatternType =
  | "greeting"
  | "introduction"
  | "authority"
  | "scarcity"
  | "offer"
  | "delivery"
  | "deadline"
  | "social_proof"
  | "permission_cta"
  | "closing_cta"
  | "follow_up"
  | "objection_softener"
  | "selection"
  | "opportunity"
  | "fallback";

export type RewritePattern = {
  confidence: number;
  importance: number;
  text: string;
  type: RewritePatternType;
};

export type CopyDiversificationInput = {
  city?: string | null;
  funnelStepName?: string | null;
  funnelStepObjective?: string | null;
  lead?: Lead | null;
  maxLength?: number;
  minChangeScore?: number;
  mode: CopyDiversificationMode;
  niche?: string | null;
  operatorName?: string | null;
  originalText: string;
  preserveMeaning?: boolean;
  renderedText?: string;
  variantSeed?: number | string;
};

export type CopyDiversificationStats = {
  changeScore: number;
  detectedPatterns: RewritePattern[];
  finalLength: number;
  modeUsed: CopyDiversificationMode;
  originalLength: number;
  preservedTriggers: string[];
  reductionPercent: number;
  semanticPreservationScore: number;
  transformationsApplied: string[];
  warnings: string[];
};

export type CopyDiversificationOutput = {
  message: string;
  stats: CopyDiversificationStats;
};

export type CopyDiversificationResponse = CopyDiversificationOutput;

export type RenderedPlaceholderContext = {
  city: string;
  company: string;
  instagram: string;
  niche: string;
  operatorName: string;
  phone: string;
  project: string;
  site: string;
};

export type SemanticValidationResult = {
  missingCriticalElements: string[];
  score: number;
  warnings: string[];
};
