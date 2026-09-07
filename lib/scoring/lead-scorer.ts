import type { Lead, ScoringCriteria, ScoringResult, LeadTier } from '@/types/lead';

const DEFAULT_CRITERIA: ScoringCriteria = {
  jobTitle: {
    weight: 25,
    keywords: {
      high: ['ceo', 'cto', 'cfo', 'coo', 'diretor', 'director', 'vp', 'vice-presidente', 'head of', 'head'],
      medium: ['gerente', 'manager', 'coordenador', 'coordinator', 'supervisor', 'líder', 'lead'],
      low: ['analista', 'analyst', 'especialista', 'specialist', 'consultor', 'consultant'],
    },
  },
  companySize: {
    weight: 20,
    ranges: [
      { min: 1000, score: 100, tier: 'enterprise' },
      { min: 200, score: 75, tier: 'mid-market' },
      { min: 50, score: 50, tier: 'smb' },
      { min: 10, score: 25, tier: 'small' },
    ],
  },
  industry: {
    weight: 15,
    highValue: ['tecnologia', 'technology', 'saas', 'software', 'fintech', 'ecommerce', 'saúde', 'healthcare', 'educação', 'education'],
    mediumValue: ['varejo', 'retail', 'atacado', 'logística', 'logistics', 'indústria', 'manufacturing'],
  },
  engagement: {
    weight: 25,
    thresholds: {
      opened: 10,
      clicked: 25,
      replied: 50,
      meeting: 80,
    },
  },
  budget: {
    weight: 15,
    thresholds: {
      high: 100000,
      medium: 25000,
      low: 5000,
    },
  },
};

function normalizeString(value: string | null | undefined): string {
  if (!value) return '';
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function scoreJobTitle(jobTitle: string | null | undefined, criteria: ScoringCriteria): number {
  if (!jobTitle) return 0;
  const normalized = normalizeString(jobTitle);
  for (const kw of criteria.jobTitle.keywords.high) {
    if (normalized.includes(kw)) return 100;
  }
  for (const kw of criteria.jobTitle.keywords.medium) {
    if (normalized.includes(kw)) return 60;
  }
  for (const kw of criteria.jobTitle.keywords.low) {
    if (normalized.includes(kw)) return 30;
  }
  return 10;
}

function scoreCompanySize(employees: number | null | undefined, criteria: ScoringCriteria): number {
  if (!employees || employees < 1) return 0;
  const range = [...criteria.companySize.ranges].sort((a, b) => b.min - a.min).find((r) => employees >= r.min);
  return range ? range.score : 0;
}

function scoreIndustry(industry: string | null | undefined, criteria: ScoringCriteria): number {
  if (!industry) return 0;
  const normalized = normalizeString(industry);
  if (criteria.industry.highValue.some((kw) => normalized.includes(kw))) return 100;
  if (criteria.industry.mediumValue.some((kw) => normalized.includes(kw))) return 60;
  return 20;
}

function scoreEngagement(metrics: Lead['engagement'] | undefined, criteria: ScoringCriteria): number {
  if (!metrics) return 0;
  let score = 0;
  if (metrics.opened > 0) score += criteria.engagement.thresholds.opened;
  if (metrics.clicked > 0) score += criteria.engagement.thresholds.clicked;
  if (metrics.replied > 0) score += criteria.engagement.thresholds.replied;
  if (metrics.meetings > 0) score += criteria.engagement.thresholds.meeting;
  return Math.min(score, 100);
}

function scoreBudget(budget: number | null | undefined, criteria: ScoringCriteria): number {
  if (!budget) return 0;
  if (budget >= criteria.budget.thresholds.high) return 100;
  if (budget >= criteria.budget.thresholds.medium) return 70;
  if (budget >= criteria.budget.thresholds.low) return 40;
  return 10;
}

export function scoreLead(lead: Lead, customCriteria?: Partial ScoringCriteria): ScoringResult {
  const criteria: ScoringCriteria = {
    jobTitle: { ...DEFAULT_CRITERIA.jobTitle, ...customCriteria?.jobTitle },
    companySize: { ...DEFAULT_CRITERIA.companySize, ...customCriteria?.companySize },
    industry: { ...DEFAULT_CRITERIA.industry, ...customCriteria?.industry },
    engagement: { ...DEFAULT_CRITERIA.engagement, ...customCriteria?.engagement },
    budget: { ...DEFAULT_CRITERIA.budget, ...customCriteria?.budget },
  };

  const breakdown = {
    jobTitle: scoreJobTitle(lead.jobTitle, criteria),
    companySize: scoreCompanySize(lead.employees, criteria),
    industry: scoreIndustry(lead.industry, criteria),
    engagement: scoreEngagement(lead.engagement, criteria),
    budget: scoreBudget(lead.budget, criteria),
  };

  const total =
    (breakdown.jobTitle * criteria.jobTitle.weight +
      breakdown.companySize * criteria.companySize.weight +
      breakdown.industry * criteria.industry.weight +
      breakdown.engagement * criteria.engagement.weight +
      breakdown.budget * criteria.budget.weight) /
    100;

  const tier: LeadTier = total >= 80 ? 'hot' : total >= 50 ? 'warm' : total >= 25 ? 'qualified' : 'cold';

  const reasons: string[] = [];
  if (breakdown.jobTitle >= 80) reasons.push('Cargo de decisão identificado');
  if (breakdown.companySize >= 70) reasons.push('Empresa de porte médio/grande');
  if (breakdown.industry >= 80) reasons.push('Indústria de alto valor');
  if (breakdown.engagement >= 50) reasons.push('Lead com engajamento ativo');
  if (breakdown.budget >= 70) reasons.push('Budget alinhado com ICP');

  return {
    leadId: lead.id,
    score: Math.round(total * 10) / 10,
    tier,
    breakdown,
    reasons,
    scoredAt: new Date().toISOString(),
  };
}

export function scoreLeadsBatch(leads: Lead[], customCriteria?: Partial ScoringCriteria): ScoringResult[] {
  return leads.map((lead) => scoreLead(lead, customCriteria)).sort((a, b) => b.score - a.score);
}

export function filterByTier(results: ScoringResult[], tier: LeadTier): ScoringResult[] {
  return results.filter((r) => r.tier === tier);
}
