/**
 * Intelligent Lead Scoring Engine
 *
 * Computes a deterministic 0-100 score for a lead based on multiple
 * weighted business signals (company size, recency, intent, channel,
 * engagement, fit). Tier classification maps to qualification funnels.
 *
 * Designed for the pub-leads module — B2B Growth, Lead Intelligence & Scraping.
 */

export type LeadTier = 'cold' | 'warm' | 'hot' | 'platinum';

export interface LeadScoringInput {
  /** Number of employees at the lead's company (0 if unknown). */
  companySize?: number;
  /** Industry vertical. */
  industry?: string;
  /** Job title / seniority. */
  role?: string;
  /** Days since the lead was first captured. */
  ageInDays?: number;
  /** Has the lead explicitly asked for a demo, quote or contact? */
  explicitIntent?: boolean;
  /** Source channel. */
  channel?: 'organic' | 'paid' | 'referral' | 'linkedin' | 'event' | 'cold-outbound' | 'import';
  /** Has a verified email and/or phone? */
  verifiedContact?: boolean;
  /** Number of prior touches / pageviews / interactions (0-50+). */
  engagementCount?: number;
  /** Has a buying committee signal (multiple contacts from same domain)? */
  buyingCommittee?: boolean;
  /** ICP fit flag — pre-classified by enrichment. */
  icpFit?: boolean;
  /** Country/region; BR prioritized for LATAM squads. */
  country?: string;
}

export interface LeadScoreResult {
  score: number;
  tier: LeadTier;
  reasons: string[];
  recommendedAction: string;
  confidence: number;
}

const SENIORITY_KEYWORDS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\b(c\-level|cmo|cto|ceo|cfo|coo|founder|owner|president|diretor|director)\b/i, weight: 18, label: 'C-level/Diretor' },
  { pattern: /\b(vp|vice president|head of|gerente|manager|head)\b/i, weight: 12, label: 'VP/Gerente' },
  { pattern: /\b(coordinator|coordenador|specialist|analyst|pleno)\b/i, weight: 6, label: 'Pleno/Coordenador' },
  { pattern: /\b(jr|junior|estag|intern|trainee|assistant)\b/i, weight: 2, label: 'Júnior' }
];

const SIZE_BANDS: Array<{ min: number; weight: number; label: string }> = [
  { min: 1000, weight: 15, label: 'Enterprise (1000+)' },
  { min: 250, weight: 12, label: 'Mid-Market (250-999)' },
  { min: 50, weight: 9, label: 'SMB (50-249)' },
  { min: 10, weight: 5, label: 'Pequena (10-49)' },
  { min: 1, weight: 2, label: 'Micro (1-9)' }
];

const CHANNEL_WEIGHTS: Record<NonNullable<LeadScoringInput['channel']>, number> = {
  referral: 14,
  'cold-outbound': 10,
  linkedin: 10,
  event: 9,
  paid: 6,
  organic: 5,
  import: 3
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function classifyTier(score: number): LeadTier {
  if (score >= 85) return 'platinum';
  if (score >= 70) return 'hot';
  if (score >= 45) return 'warm';
  return 'cold';
}

function nextAction(tier: LeadTier): string {
  switch (tier) {
    case 'platinum':
      return 'Atendimento humano imediato via WhatsApp + SDR ligar em até 15min.';
    case 'hot':
      return 'Enviar sequência personalizada WhatsApp + email com case relevante em 1h.';
    case 'warm':
      return 'Nutrir com conteúdo segmentado e reavaliar em 48h.';
    default:
      return 'Manter em lista de低温 nurturing; reavaliar após nova interação.';
  }
}

/**
 * Compute a deterministic lead score.
 */
export function scoreLead(input: LeadScoringInput): LeadScoreResult {
  const reasons: string[] = [];
  let raw = 0;
  let confidenceSignals = 0;
  let totalSignals = 0;

  // 1. Company size
  totalSignals++;
  const size = input.companySize ?? 0;
  if (size > 0) {
    const band = SIZE_BANDS.find((b) => size >= b.min);
    if (band) {
      raw += band.weight;
      reasons.push(`Tamanho da empresa: ${band.label} (+${band.weight})`);
      confidenceSignals++;
    }
  }

  // 2. Seniority / role
  totalSignals++;
  if (input.role) {
    const hit = SENIORITY_KEYWORDS.find((s) => s.pattern.test(input.role!));
    if (hit) {
      raw += hit.weight;
      reasons.push(`Cargo detectado: ${hit.label} (+${hit.weight})`);
      confidenceSignals++;
    }
  }

  // 3. Recency (fresher leads score higher)
  totalSignals++;
  const age = input.ageInDays ?? -1;
  if (age >= 0) {
    let recencyWeight = 0;
    if (age <= 1) recencyWeight = 12;
    else if (age <= 7) recencyWeight = 9;
    else if (age <= 30) recencyWeight = 5;
    else if (age <= 90) recencyWeight = 2;
    if (recencyWeight > 0) {
      raw += recencyWeight;
      reasons.push(`Idade do lead: ${age}d (+${recencyWeight})`);
      confidenceSignals++;
    }
  }

  // 4. Explicit intent (hard signal)
  totalSignals++;
  if (input.explicitIntent) {
    raw += 20;
    reasons.push('Intenção explícita (demo/cotação/contato) (+20)');
    confidenceSignals++;
  }

  // 5. Channel
  totalSignals++;
  if (input.channel && CHANNEL_WEIGHTS[input.channel] !== undefined) {
    const w = CHANNEL_WEIGHTS[input.channel];
    raw += w;
    reasons.push(`Canal: ${input.channel} (+${w})`);
    confidenceSignals++;
  }

  // 6. Verified contact
  totalSignals++;
  if (input.verifiedContact) {
    raw += 6;
    reasons.push('Contato verificado (+6)');
    confidenceSignals++;
  }

  // 7. Engagement volume
  totalSignals++;
  const engagement = input.engagementCount ?? 0;
  if (engagement > 0) {
    const engWeight = clamp(engagement, 0, 12);
    raw += engWeight;
    reasons.push(`Engajamento: ${engagement} interações (+${engWeight})`);
    confidenceSignals++;
  }

  // 8. Buying committee
  totalSignals++;
  if (input.buyingCommittee) {
    raw += 8;
    reasons.push('Sinal de comitê de compra detectado (+8)');
    confidenceSignals++;
  }

  // 9. ICP fit
  totalSignals++;
  if (input.icpFit) {
    raw += 10;
    reasons.push('ICP fit pré-classificado (+10)');
    confidenceSignals++;
  }

  // 10. Geo: BR/LATAM priority
  totalSignals++;
  const geo = (input.country ?? '').toUpperCase();
  if (geo === 'BR' || geo === 'BRASIL' || geo === 'BRAZIL') {
    raw += 4;
    reasons.push('Geo prioritário (Brasil/LATAM) (+4)');
    confidenceSignals++;
  }

  const score = clamp(raw);
  const tier = classifyTier(score);
  const confidence = totalSignals === 0 ? 0 : Math.round((confidenceSignals / totalSignals) * 100);

  return {
    score,
    tier,
    reasons,
    recommendedAction: nextAction(tier),
    confidence
  };
}

/**
 * Bulk scoring helper.
 */
export function scoreLeadsBatch(inputs: LeadScoringInput[]): LeadScoreResult[] {
  return inputs.map(scoreLead);
}

/**
 * Filters leads above a minimum tier threshold.
 */
export function filterByTier(
  inputs: LeadScoringInput[],
  minTier: LeadTier
): LeadScoreResult[] {
  const order: Record<LeadTier, number> = { cold: 0, warm: 1, hot: 2, platinum: 3 };
  const min = order[minTier];
  return inputs
    .map(scoreLead)
    .filter((r) => order[r.tier] >= min);
}
