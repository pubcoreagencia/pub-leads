import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

/**
 * POST /api/leads/bulk-import
 *
 * Receives a batch of leads (CSV-like JSON array), validates each record,
 * deduplicates against existing fingerprints, enqueues for async enrichment
 * (WhatsApp + AI scoring) and returns a structured import report.
 *
 * Body:
 * {
 *   "source": "csv-upload" | "apollo" | "linkedin" | "manual",
 *   "campaignId": "string?",
 *   "dryRun": boolean?,
 *   "items": [
 *     {
 *       "name": "string",
 *       "email": "string?",
 *       "phone": "string?",
 *       "company": "string?",
 *       "title": "string?",
 *       "linkedinUrl": "string?",
 *       "tags": "string[]?"
 *     }
 *   ]
 * }
 */

const LeadSchema = z.object({
  name: z.string().trim().min(2, 'name too short').max(120),
  email: z
    .string()
    .trim()
    .email('invalid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9\s().-]{8,20}$/, 'invalid phone')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  company: z.string().trim().max(160).optional(),
  title: z.string().trim().max(160).optional(),
  linkedinUrl: z.string().trim().url('invalid linkedin url').optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});

const BodySchema = z.object({
  source: z.enum(['csv-upload', 'apollo', 'linkedin', 'manual']),
  campaignId: z.string().trim().min(1).optional(),
  dryRun: z.boolean().optional().default(false),
  items: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

type ImportReport = {
  jobId: string;
  received: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  dryRun: boolean;
  durationMs: number;
  errors: Array<{ index: number; reason: string }>;
  acceptedLeads: Array<{
    id: string;
    name: string;
    fingerprint: string;
    score: number;
    queuedFor: Array<'whatsapp' | 'ai-scoring' | 'enrichment'>;
  }>;
};

// ---------- Helpers ----------

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D+/g, '');
  return digits.length >= 8 ? digits : undefined;
}

function leadFingerprint(input: {
  email?: string;
  phone?: string;
  name?: string;
}): string {
  const email = (input.email || '').toLowerCase().trim();
  const phone = normalizePhone(input.phone) || '';
  const name = (input.name || '').toLowerCase().trim();
  const seed = `${email}|${phone}|${name}`;
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function naiveScore(lead: {
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
}): number {
  let score = 0;
  if (lead.email) score += 25;
  if (lead.phone) score += 20;
  if (lead.company) score += 15;
  if (lead.title) score += 15;
  if (lead.linkedinUrl) score += 10;
  // executive boost
  if (lead.title && /(ceo|cto|cmo|director|head|founder|vp)/i.test(lead.title)) {
  score += 15;
  }
  return Math.min(score, 100);
}

// In-memory dedup cache. In production this is backed by Redis/DB.
const SEEN_FINGERPRINTS = new Map<string, number>();

function isDuplicate(fp: string): boolean {
  const count = SEEN_FINGERPRINTS.get(fp) || 0;
  SEEN_FINGERPRINTS.set(fp, count + 1);
  return count > 0;
}

// ---------- Route Handler ----------

export async function POST(req: NextRequest) {
  const started = Date.now();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'validation_failed',
        issues: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  const { source, campaignId, dryRun, items } = parsed.data;
  const jobId = `imp_${crypto.randomBytes(8).toString('hex')}`;

  const report: ImportReport = {
    jobId,
    received: items.length,
    accepted: 0,
    rejected: 0,
    duplicates: 0,
    dryRun,
    durationMs: 0,
    errors: [],
    acceptedLeads: [],
  };

  for (let index = 0; index < items.length; index++) {
    const raw = items[index];
    const validated = LeadSchema.safeParse(raw);

    if (!validated.success) {
      report.rejected += 1;
      report.errors.push({
        index,
        reason: validated.error.issues
          .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
          .join('; '),
      });
      continue;
    }

    const lead = validated.data;
    const fingerprint = leadFingerprint(lead);

    if (isDuplicate(fingerprint)) {
      report.duplicates += 1;
      report.errors.push({ index, reason: 'duplicate_fingerprint' });
      continue;
    }

    const score = naiveScore(lead);
    const id = `ld_${crypto.randomBytes(6).toString('hex')}`;

    const queuedFor: Array<'whatsapp' | 'ai-scoring' | 'enrichment'> = [];
    if (lead.phone) queuedFor.push('whatsapp');
    if (lead.email || lead.linkedinUrl) queuedFor.push('enrichment');
    if (score >= 30) queuedFor.push('ai-scoring');

    report.accepted += 1;
    report.acceptedLeads.push({
      id,
      name: lead.name,
      fingerprint,
      score,
      queuedFor,
    });

    if (!dryRun) {
      // Placeholder: real persistence + queue dispatch would happen here.
      // e.g. await db.lead.create(...); await enqueue('whatsapp', {...})
      console.info('[bulk-import]', {
        jobId,
        source,
        campaignId,
        leadId: id,
        fingerprint,
        score,
        queuedFor,
      });
    }
  }

  report.durationMs = Date.now() - started;

  return NextResponse.json(
    {
      ok: true,
      report,
    },
    { status: 200 },
  );
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/leads/bulk-import',
    method: 'POST',
    description: 'Bulk import leads with validation, dedup and async enrichment.',
    schema: {
      source: ['csv-upload', 'apollo', 'linkedin', 'manual'],
      campaignId: 'string?',
      dryRun: 'boolean?',
      items: 'Array<Lead> (1..5000)',
    },
  });
}
