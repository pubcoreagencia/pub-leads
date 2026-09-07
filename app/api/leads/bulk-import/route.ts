import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ratelimit } from '@/lib/ratelimit';

const leadSchema = z.object({
  name: z.string().min(2).max(120).transform((v) => v.trim()),
  email: z.string().email().optional().or(z.literal('')).transform((v) => v?.toLowerCase() || null),
  phone: z.string().regex(/^\+?[\d\s\-()]{8,20}$/).optional().or(z.literal('')).transform((v) => v?.replace(/\s/g, '') || null),
  company: z.string().max(120).optional().transform((v) => v?.trim() || null),
  title: z.string().max(120).optional().transform((v) => v?.trim() || null),
  linkedinUrl: z.string().url().optional().or(z.literal('')).transform((v) => v?.trim() || null),
  source: z.enum(['csv', 'apollo', 'linkedin', 'manual', 'referral', 'event', 'inbound']).default('manual'),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const bulkImportSchema = z.object({
  leads: z.array(leadSchema).min(1).max(5000),
  options: z.object({
    skipDuplicates: z.boolean().default(true),
    triggerEnrichment: z.boolean().default(true),
    assignToListId: z.string().cuid().optional(),
    campaignId: z.string().cuid().optional(),
    defaultOwnerId: z.string().cuid().optional(),
  }).optional().default({}),
});

type BulkImportBody = z.infer<typeof bulkImportSchema>;

function computeLeadHash(lead: { email?: string | null; phone?: string | null; linkedinUrl?: string | null; name?: string }) {
  const basis = [lead.email, lead.phone, lead.linkedinUrl, lead.name?.toLowerCase()]
    .filter(Boolean)
    .join('|');
  return createHash('sha256').update(basis).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = `bulk-import:${session.user.id}`;
    const { success, remaining, reset } = await ratelimit.limit(identifier, { limit: 10, window: '5m' });
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', remaining, reset },
        { status: 429 }
      );
    }

    const rawBody = await req.json();
    const parsed = bulkImportSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { leads, options } = parsed.data;
    const tenantId = (session.user as any).tenantId as string;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not resolved' }, { status: 403 });
    }

    const batchId = crypto.randomUUID();
    const now = new Date();

    const enriched = leads.map((lead) => ({
      ...lead,
      tenantId,
      hash: computeLeadHash(lead),
      importedAt: now,
      importedBy: session.user.id,
      batchId,
    }));

    const existingHashes = new Set<string>();
    if (options.skipDuplicates) {
      const hashes = enriched.map((l) => l.hash);
      const existing = await prisma.lead.findMany({
        where: { tenantId, hash: { in: hashes } },
        select: { hash: true },
      });
      existing.forEach((row) => existingHashes.add(row.hash));
    }

    const toInsert = enriched.filter((lead) => !existingHashes.has(lead.hash));
    const skipped = enriched.length - toInsert.length;

    const CHUNK_SIZE = 500;
    let inserted = 0;
    const errors: Array<{ index: number; message: string }> = [];

    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      try {
        const result = await prisma.$transaction(
          chunk.map((lead) =>
            prisma.lead.upsert({
              where: { tenantId_hash: { tenantId, hash: lead.hash } },
              create: {
                tenantId: lead.tenantId,
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                company: lead.company,
                title: lead.title,
                linkedinUrl: lead.linkedinUrl,
                source: lead.source,
                tags: lead.tags,
                customFields: lead.customFields as any,
                hash: lead.hash,
                batchId: lead.batchId,
                importedAt: lead.importedAt,
                importedBy: lead.importedBy,
                score: 0,
                status: 'NEW',
              },
              update: {},
            })
          )
        );
        inserted += result.length;
      } catch (err: any) {
        chunk.forEach((_, idx) => {
          errors.push({ index: i + idx, message: err?.message || 'Insert failed' });
        });
      }
    }

    if (options.assignToListId && inserted > 0) {
      const list = await prisma.leadList.findUnique({
        where: { id: options.assignToListId },
        select: { id: true, tenantId: true },
      });
      if (list && list.tenantId === tenantId) {
        const insertedHashes = toInsert.map((l) => l.hash);
        const newLeads = await prisma.lead.findMany({
          where: { tenantId, hash: { in: insertedHashes } },
          select: { id: true },
        });
        await prisma.leadListMember.createMany({
          data: newLeads.map((lead) => ({
            listId: list.id,
            leadId: lead.id,
            addedBy: session.user.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    await prisma.importLog.create({
      data: {
        tenantId,
        batchId,
        userId: session.user.id,
        totalReceived: leads.length,
        inserted,
        skipped,
        errors: errors as any,
        options: options as any,
      },
    });

    if (options.triggerEnrichment && inserted > 0) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/cron/enrich-leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': process.env.INTERNAL_CRON_TOKEN || '',
          },
          body: JSON.stringify({ batchId, tenantId }),
        });
      } catch (e) {
        console.warn('[bulk-import] enrichment trigger failed', e);
      }
    }

    return NextResponse.json({
        batchId,
        summary: {
          received: leads.length,
          inserted,
          skipped,
          failed: errors.length,
        },
        errors: errors.length ? errors : undefined,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[bulk-import] fatal', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err?.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get('batchId');

  const where: any = { tenantId };
  if (batchId) where.batchId = batchId;

  const logs = await prisma.importLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      batchId: true,
      totalReceived: true,
      inserted: true,
      skipped: true,
      errors: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}
