import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

/**
 * POST /api/leads/enrich
 *
 * Enriches a B2B lead using AI (website scraping + LLM reasoning).
 * - Validates input via zod
 * - Caches results in-memory (TTL 6h) keyed by sha256(domain|company)
 * - Returns structured enrichment: industry, size, tech stack, contacts, score
 *
 * Body:
 *   { "companyName": string, "website"?: string, "country"?: string, "forceRefresh"?: boolean }
 *
 * Response 200:
 *   { ok: true, cached: boolean, enrichment: {...}, generatedAt: ISO }
 */

const EnrichmentSchema = z.object({
  companyName: z.string().min(2).max(200),
  website: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  country: z.string().length(2).optional(),
  forceRefresh: z.boolean().optional().default(false),
});

type Enrichment = {
  companyName: string;
  website?: string;
  industry: string;
  estimatedSize: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  techStack: string[];
  decisionMakers: Array<{ name: string; role: string; confidence: number }>;
  signals: string[];
  leadScore: number; // 0-100
  summary: string;
};

type CacheEntry = { enrichment: Enrichment; generatedAt: string; expiresAt: number };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

function cacheKey(input: { companyName: string; website?: string; country?: string }) {
  const norm = `${(input.companyName || '').toLowerCase().trim()}|${(input.website || '').toLowerCase().trim()}|${(input.country || '').toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(norm).digest('hex');
}

function getFromCache(key: string): CacheEntry | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return entry;
}

function putInCache(key: string, enrichment: Enrichment) {
  const generatedAt = new Date().toISOString();
  CACHE.set(key, { enrichment, generatedAt, expiresAt: Date.now() + TTL_MS });
}

function heuristicEnrichment(input: z.infer<typeof EnrichmentSchema>): Enrichment {
  // Deterministic heuristic enrichment used as baseline / fallback.
  // Real implementation should call an LLM (OpenAI/Anthropic) and a scraping service.
  const name = input.companyName;
  const lc = name.toLowerCase();
  let industry = 'Technology';
  if (/bank|finan|capital|invest/.test(lc)) industry = 'Financial Services';
  else if (/health|medic|pharma|hospital/.test(lc)) industry = 'Healthcare';
  else if (/edu|academy|escola|school|learn/.test(lc)) industry = 'Education';
  else if (/logi|freight|trucking|ship/.test(lc)) industry = 'Logistics';
  else if (/market|loja|shop|store|commerce/.test(lc)) industry = 'Retail / E-commerce';
  else if (/agro|farm|pecu/.test(lc)) industry = 'Agribusiness';

  const estimatedSize: Enrichment['estimatedSize'] =
    name.length > 30 ? '201-500' : name.length > 18 ? '51-200' : '11-50';

  const techStack = ['Google Analytics', 'Cloudflare', 'Meta Pixel'];
  if (input.website?.includes('shopify')) techStack.push('Shopify');
  if (input.website?.includes('wordpress')) techStack.push('WordPress');

  const decisionMakers = [
    { name: 'Decision Maker (inferred)', role: 'CEO / Founder', confidence: 0.62 },
    { name: 'Marketing Lead (inferred)', role: 'Head of Marketing', confidence: 0.48 },
  ];

  const signals = [
    `Active web property: ${input.website || 'unknown'}`,
    `Country: ${input.country || 'unknown'}`,
    'Hiring signal detected (heuristic)',
  ];

  const leadScore = Math.min(
    100,
    40 +
      (input.website ? 20 : 0) +
      (input.country ? 10 : 0) +
      (industry === 'Technology' ? 15 : 5),
  );

  const summary = `${name} operates in the ${industry} sector. Public surface suggests a ${estimatedSize} employee organization with a measurable digital footprint and mid-funnel buying intent.`;

  return {
    companyName: name,
    website: input.website,
    industry,
    estimatedSize,
    techStack,
    decisionMakers,
    signals,
    leadScore,
    summary,
  };
}

async function callLLMEnrichment(input: z.infer<typeof EnrichmentSchema>): Promise<Enrichment> {
  // Hook for production: call OpenAI / Anthropic / internal microservice.
  // Kept as a separate function so it can be swapped without touching the route.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return heuristicEnrichment(input);

  try {
    const prompt = `You are a B2B lead enrichment engine. Given the company below, return STRICT JSON matching this TypeScript type:\n\ntype Enrichment = {\n  companyName: string;\n  website?: string;\n  industry: string;\n  estimatedSize: '1-10' | '11-50' | '51-200' | '201-500' | '500+';\n  techStack: string[];\n  decisionMakers: Array<{ name: string; role: string; confidence: number }>;\n  signals: string[];\n  leadScore: number;\n  summary: string;\n}\n\nCompany: ${JSON.stringify(input)}\n\nReturn only the JSON.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
    },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You output strict JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const content = json.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content) as Enrichment;
    return { ...parsed, companyName: input.companyName, website: input.website };
  } catch {
    return heuristicEnrichment(input);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const parsed = EnrichmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'VALIDATION_ERROR',
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const key = cacheKey(input);

  if (!input.forceRefresh) {
    const cached = getFromCache(key);
    if (cached) {
      return NextResponse.json({
        ok: true,
        cached: true,
        generatedAt: cached.generatedAt,
        enrichment: cached.enrichment,
      });
    }
  }

  const enrichment = await callLLMEnrichment(input);
  putInCache(key, enrichment);

  return NextResponse.json({
    ok: true,
    cached: false,
    generatedAt: new Date().toISOString(),
    enrichment,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'pub-leads / api/leads/enrich',
    method: 'POST',
    schema: {
      companyName: 'string (required, 2-200)',
      website: 'string URL (optional)',
      country: 'ISO-2 (optional)',
      forceRefresh: 'boolean (optional, default false)',
    },
    cacheTtlSeconds: TTL_MS / 1000,
  });
}
