/**
 * Pub Leads - Pipeline Autônomo de Enriquecimento e Scoring
 * Gerado autonomamente pela Central de Agentes da Pub Core
 * Ciclo: #110 | Agente: b2b-growth-leads-tech-lead
 */

export interface RawLeadInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  cnpj?: string;
}

export interface EnrichedLeadProfile extends RawLeadInput {
  score: number;
  icpFit: 'HIGH' | 'MEDIUM' | 'LOW';
  domainVerified: boolean;
  recommendedChannel: 'WHATSAPP' | 'EMAIL' | 'CALL';
  enrichedAt: string;
}

export class AutonomousLeadEnrichmentEngine {
  public static calculateScore(lead: RawLeadInput): number {
    let score = 20;
    if (lead.cnpj) score += 30;
    if (lead.phone) score += 20;
    if (lead.email && !lead.email.endsWith('@gmail.com') && !lead.email.endsWith('@hotmail.com')) {
      score += 30; // Corporative domain bonus
    }
    return Math.min(100, score);
  }

  public static enrich(lead: RawLeadInput): EnrichedLeadProfile {
    const score = this.calculateScore(lead);
    const icpFit = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
    const isCorporate = Boolean(lead.email && !lead.email.includes('gmail') && !lead.email.includes('outlook'));

    return {
      ...lead,
      score,
      icpFit,
      domainVerified: isCorporate,
      recommendedChannel: lead.phone ? 'WHATSAPP' : 'EMAIL',
      enrichedAt: new Date().toISOString(),
    };
  }
}
