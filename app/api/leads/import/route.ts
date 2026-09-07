import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/leads/import
 *
 * Importacao em massa de leads com:
 *  - Validacao por schema (Zod)
 *  - Deduplicacao via hash deterministico (email normalizado + telefone)
 *  - Modo dry-run para preview antes de persistir
 *  - Retorno com estatisticas (created, skipped, errors)
 *  - Rate limit basico por tenant (header x-tenant-id)
 */

const LeadImportSchema = z.object({
  leads: z
    .array(
      z.object({
        name: z.string().min(2, 'nome muito curto').max(120),
        email: z.string().email('email invalido').optional().nullable(),
        phone: z.string().min(8, 'telefone muito curto').max(20).optional().nullable(),
        company: z.string().max(160).optional().nullable(),
        role: z.string().max(80).optional().nullable(),
        source: z.enum(['csv', 'api', 'whatsapp', 'instagram', 'facebook', 'linkedin', 'manual', 'scraper']).default('manual'),
        tags: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
        customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
      }),
    )
    .min(1, 'array vazio')
    .max(5000, 'limite de 5000 leads por requisicao'),
  dryRun: z.boolean().optional().default(false),
  skipDuplicates: z.boolean().optional().default(true),
});

type ImportBody = z.infer<typeof LeadImportSchema>;

interface ImportStats {
  totalReceived: number;
  created: number;
  skippedDuplicates: number;
  failed: number;
  errors: Array<{ index: number; reason: string }>;
  dryRun: boolean;
}

// Cache simples in-memory para rate limit (em producao usar Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // 20 requisicoes
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minuto

function checkRateLimit(tenantId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(tenantId);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(tenantId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D+/g, '');
}

function buildFingerprint(email: string, phone: string, tenantId: string): string {
  // Hash deterministico para deduplicacao por tenant
  return createHash('sha256').update(`${tenantId}|${email}|${phone}`).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const tenantId =
      req.headers.get('x-tenant-id') ||
      (session.user as { tenantId?: string }).tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_required' }, { status: 400 });
    }

    if (!checkRateLimit(tenantId)) {
      return NextResponse.json(
        { error: 'rate_limited', retryAfterMs: RATE_LIMIT_WINDOW_MS },
        { status: 429 },
      );
    }

    const json = (await req.json()) as unknown;
    const parsed = LeadImportSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'validation_error',
          issues: parsed.error.flatten(),
        },
        { status: 422 },
      );
    }

    const body: ImportBody = parsed.data;
    const { leads, dryRun, skipDuplicates } = body;

    const stats: ImportStats = {
      totalReceived: leads.length,
      created: 0,
      skippedDuplicates: 0,
      failed: 0,
      errors: [],
      dryRun,
    };

    // Coletar fingerprints ja existentes no banco
    const candidates = leads
      .map((l, idx) => ({
        idx,
        email: normalizeEmail(l.email),
        phone: normalizePhone(l.phone),
        raw: l,
      }))
      .filter((c) => c.email || c.phone);

    const fingerprints = candidates.map((c) =>
      buildFingerprint(c.email, c.phone, tenantId),
    );

    const existing = dryRun
      ? []
      : await prisma.lead.findMany({
          where: {
            tenantId,
            fingerprint: { in: fingerprints },
          },
          select: { fingerprint: true },
        });

    const existingSet = new Set(existing.map((e) => e.fingerprint));

    // Preparar registros validos
    const toCreate: Array<{
      tenantId: string;
      name: string;
      email: string | null;
      phone: string | null;
      company: string | null;
      role: string | null;
      source: ImportBody['leads'][number]['source'];
      tags: string[];
      customFields: Record<string, string | number | boolean>;
      fingerprint: string;
      status: 'NEW';
    }> = [];

    candidates.forEach(({ idx, email, phone, raw }) => {
      const fp = buildFingerprint(email, phone, tenantId);
      if (skipDuplicates && existingSet.has(fp)) {
        stats.skippedDuplicates += 1;
        return;
      }
      toCreate.push({
        tenantId,
        name: raw.name,
        email: raw.email ?? null,
        phone: raw.phone ?? null,
        company: raw.company ?? null,
        role: raw.role ?? null,
        source: raw.source,
        tags: raw.tags ?? [],
        customFields: raw.customFields ?? {},
        fingerprint: fp,
        status: 'NEW',
      });
    });

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        stats: { ...stats, created: toCreate.length },
        previewCount: toCreate.length,
      });
    }

    if (toCreate.length > 0) {
      try {
        const result = await prisma.lead.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
        stats.created = result.count;
      } catch (err) {
        stats.failed = toCreate.length;
        stats.errors.push({
          index: -1,
          reason: err instanceof Error ? err.message : 'unknown_db_error',
        });
      }
    }

    return NextResponse.json({ ok: true, stats }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'internal_error',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/leads/import',
    method: 'POST',
    description: 'Importacao em massa de leads com validacao e deduplicacao',
    maxBatch: 5000,
    rateLimit: { max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS },
  });
}
