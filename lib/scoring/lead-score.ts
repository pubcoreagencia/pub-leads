// lib/scoring/lead-score.ts
// B2B Lead Scoring Engine - BANT Methodology (Budget, Authority, Need, Timeline)
// Production-ready scoring system for pub-leads module

export type LeadTier = 'hot' | 'warm' | 'cold' | 'unqualified';

export interface ScoreInput {
  budget?: number | null;           // Estimated budget in BRL
  hasDecisionAuthority?: boolean;   // Is decision maker?
  hasExplicitNeed?: boolean;        // Expressed need/pain?
  expectedCloseDays?: number | null; // Days to close
  companySize?: number | null;      // Number of employees
  industryFit?: number;             // 0-100 industry fit score
  engagementScore?: number;         // 0-100 from interactions
  source?: string;                  // Lead source channel
  hasContactInfo?: boolean;         // Valid email/phone?
  previousInteractions?: number;    // Touch points count
}

export interface ScoreBreakdown {
  budget: number;
  authority: number;
  need: number;
  timeline: number;
  company: number;
  engagement: number;
  fit: number;
}

export interface ScoreResult {
  score: number;           // 0-100
  tier: LeadTier;
  breakdown: ScoreBreakdown;
  reasons: string[];       // Human-readable explanations
  recommendedAction: string;
  nextFollowUpDays: number;
}

const WEIGHTS = {
  budget: 0.25,
  authority: 0.20,
  need: 0.15,
  timeline: 0.15,
  company: 0.10,
  engagement: 0.10,
  fit: 0.05,
} as const;

function scoreBudget(budget: number | null | undefined): number {
  if (!budget || budget <= 0) return 0;
  if (budget >= 100000) return 100;
  if (budget >= 50000) return 85;
  if (budget >= 20000) return 70;
  if (budget >= 10000) return 55;
  if (budget >= 5000) return 40;
  if (budget >= 1000) return 25;
  return 10;
}

function scoreTimeline(days: number | null | undefined): number {
  if (days === null || days === undefined) return 30;
  if (days <= 7) return 100;
  if (days <= 30) return 85;
  if (days <= 60) return 65;
  if (days <= 90) return 45;
  if (days <= 180) return 25;
  return 10;
}

function scoreCompany(size: number | null | undefined): number {
  if (!size || size <= 0) return 30;
  if (size >= 1000) return 100;
  if (size >= 500) return 90;
  if (size >= 100) return 75;
  if (size >= 50) return 60;
  if (size >= 10) return 45;
  return 25;
}

function classifyTier(score: number): LeadTier {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 35) return 'cold';
  return 'unqualified';
}

function getRecommendedAction(tier: LeadTier, score: number): { action: string; days: number } {
  switch (tier) {
    case 'hot':
      return {
        action: 'Prioridade máxima: agendar reunião com SDR sênior em até 24h e enviar proposta personalizada.',
        days: 1,
      };
    case 'warm':
      return {
        action: 'Nutrir com conteúdo relevante (cases, ROI) e agendar discovery call.',
        days: 3,
      };
    case 'cold':
      return {
        action: 'Incluir em campanha de nurturing automatizada e qualificar via WhatsApp.',
        days: 7,
      };
    default:
      return {
        action: 'Manter em base para campanhas de longo prazo; reavaliar após sinais de engajamento.',
        days: 30,
      };
  }
}

export function calculateLeadScore(input: ScoreInput): ScoreResult {
  const reasons: string[] = [];

  const budgetScore = scoreBudget(input.budget);
  if (budgetScore >= 70) reasons.push(`Budget forte detectado (R$ ${input.budget?.toLocaleString('pt-BR')}).`);
  else if (budgetScore === 0) reasons.push('Budget não informado — bloqueia avanço.');

  const authorityScore = input.hasDecisionAuthority === true ? 100 : input.hasDecisionAuthority === false ? 20 : 40;
  if (authorityScore === 100) reasons.push('Tomador de decisão confirmado.');
  else if (authorityScore === 20) reasons.push('Contato sem autoridade decisória — buscar sponsor.');

  const needScore = input.hasExplicitNeed === true ? 100 : input.hasExplicitNeed === false ? 25 : 50;
  if (needScore === 100) reasons.push('Necessidade/dor explicitamente declarada.');

  const timelineScore = scoreTimeline(input.expectedCloseDays);
  if (input.expectedCloseDays !== null && input.expectedCloseDays !== undefined && input.expectedCloseDays <= 30) {
    reasons.push(`Janela de compra curta (${input.expectedCloseDays} dias).`);
  }

  const companyScore = scoreCompany(input.companySize);
  if (companyScore >= 75) reasons.push(`Empresa de porte relevante (${input.companySize} colaboradores).`);

  const engagementRaw = Math.min(100, Math.max(0, input.engagementScore ?? 0));
  const interactionBonus = Math.min(20, (input.previousInteractions ?? 0) * 4);
  const engagementScore = Math.min(100, engagementRaw + interactionBonus);
  if (engagementScore >= 60) reasons.push('Engajamento alto nas últimas interações.');

  const fitScore = Math.min(100, Math.max(0, input.industryFit ?? 50));
  if (fitScore >= 70) reasons.push('Alta aderência ao ICP (perfil de cliente ideal).');

  if (input.hasContactInfo === false) reasons.push('Sem dados de contato válidos — baixa qualificação.');

  const rawScore =
    budgetScore * WEIGHTS.budget +
    authorityScore * WEIGHTS.authority +
    needScore * WEIGHTS.need +
    timelineScore * WEIGHTS.timeline +
    companyScore * WEIGHTS.company +
    engagementScore * WEIGHTS.engagement +
    fitScore * WEIGHTS.fit;

  const finalScore = Math.round(Math.min(100, Math.max(0, rawScore)));
  const tier = classifyTier(finalScore);
  const { action, days } = getRecommendedAction(tier, finalScore);

  return {
    score: finalScore,
    tier,
    breakdown: {
      budget: Math.round(budgetScore),
      authority: Math.round(authorityScore),
      need: Math.round(needScore),
      timeline: Math.round(timelineScore),
      company: Math.round(companyScore),
      engagement: Math.round(engagementScore),
      fit: Math.round(fitScore),
    },
    reasons,
    recommendedAction: action,
    nextFollowUpDays: days,
  };
}

export function batchScoreLeads<T extends ScoreInput>(leads: T[]): Array<T & { scoring: ScoreResult }> {
  return leads.map((lead) => ({
    ...lead,
    scoring: calculateLeadScore(lead),
  }));
}

export function tierPriority(tier: LeadTier): number {
  const map: Record<LeadTier, number> = { hot: 1, warm: 2, cold: 3, unqualified: 4 };
  return map[tier];
}
