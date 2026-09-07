import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/lead-notes
 * Lista notas de leads com filtros avançados, paginação cursor-based e
 * projeção otimizada. Suporta busca full-text, filtros por lead, autor,
 * tipo e intervalo de datas. Ordena por pinned first, depois updatedAt desc.
 */

const QuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  leadId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
  type: z.enum(['GENERAL', 'CALL', 'MEETING', 'TASK', 'FOLLOW_UP', 'COMPLAINT', 'OPPORTUNITY']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  pinned: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId, route: 'GET /api/lead-notes' });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: 'unauthorized', message: auth.reason },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const rl = await rateLimit({
      key: `lead-notes:list:${auth.user.tenantId}:${auth.user.id}`,
      limit: 120,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'rate_limited', retryAfter: rl.retryAfter },
        { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': String(rl.retryAfter) } }
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_query', issues: parsed.error.flatten() },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const params = parsed.data;

    if (params.startDate && params.endDate && params.startDate > params.endDate) {
      return NextResponse.json(
        { error: 'invalid_date_range', message: 'startDate must be before endDate' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const where: any = {
      tenantId: auth.user.tenantId,
    };

    if (!params.includeDeleted) {
      where.deletedAt = null;
    }

    if (params.leadId) where.leadId = params.leadId;
    if (params.authorId) where.authorId = params.authorId;
    if (params.type) where.type = params.type;
    if (params.priority) where.priority = params.priority;
    if (typeof params.pinned === 'boolean') where.pinned = params.pinned;

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { content: { contains: params.search, mode: 'insensitive' } },
        { tags: { has: params.search.toLowerCase() } },
      ];
    }

    if (params.cursor) {
      const cursorNote = await prisma.leadNote.findFirst({
        where: { id: params.cursor, tenantId: auth.user.tenantId },
        select: { pinned: true, updatedAt: true, id: true },
      });
      if (!cursorNote) {
        return NextResponse.json(
          { error: 'invalid_cursor' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      where.OR = [
        ...(where.OR ?? []),
        { pinned: { lt: cursorNote.pinned } },
        {
          AND: [
            { pinned: { equals: cursorNote.pinned } },
            { updatedAt: { lt: cursorNote.updatedAt } },
          ],
        },
        {
          AND: [
            { pinned: { equals: cursorNote.pinned } },
            { updatedAt: { equals: cursorNote.updatedAt } },
            { id: { lt: cursorNote.id } },
          ],
        },
      ];
    }

    const notes = await prisma.leadNote.findMany({
      where,
      orderBy: [
        { pinned: 'desc' },
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
      take: params.limit + 1,
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        priority: true,
        pinned: true,
        tags: true,
        metadata: true,
        lead: {
          select: {
            id: true,
            name: true,
            company: true,
            status: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasNextPage = notes.length > params.limit;
    const items = hasNextPage ? notes.slice(0, params.limit) : notes;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    const aggregate = await prisma.leadNote.aggregate({
      where: { ...where, OR: undefined, id: undefined },
      _count: { _all: true },
      _avg: { priorityRank: true },
    }).catch(() => null);

    log.info(
      { count: items.length, hasNextPage, filters: Object.keys(params) },
      'lead notes list fetched'
    );

    return NextResponse.json(
      {
        data: items.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        })),
        pagination: {
          nextCursor,
          hasNextPage,
          limit: params.limit,
        },
        meta: {
          totalApprox: aggregate?._count?._all ?? null,
          requestId,
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    log.error({ err: err?.message, stack: err?.stack }, 'failed to list lead notes');
    return NextResponse.json(
      { error: 'internal_error', requestId },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
