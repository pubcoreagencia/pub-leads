import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const leadNoteCreateSchema = z.object({
  leadId: z.string().min(1, 'leadId required'),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  pinned: z.boolean().optional(),
});

const leadNoteUpdateSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  pinned: z.boolean().optional(),
});

const querySchema = z.object({
  leadId: z.string().optional(),
  tag: z.string().optional(),
  pinned: z.enum(['true', 'false']).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['recent', 'oldest', 'pinned']).default('recent'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit({ key: `lead-notes:create:${session.user.id}`, limit: 60, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = leadNoteCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: parsed.data.leadId, OR: [{ ownerId: session.user.id }, { sharedWith: { some: { userId: session.user.id } } }] },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found or access denied' }, { status: 404 });
    }

    const note = await prisma.leadNote.create({
      data: {
        leadId: parsed.data.leadId,
        authorId: session.user.id,
        content: parsed.data.content,
        tags: parsed.data.tags ?? [],
        pinned: parsed.data.pinned ?? false,
      },
    });

    await prisma.leadActivity.create({
      data: { leadId: parsed.data.leadId, userId: session.user.id, type: 'NOTE_ADDED', payload: { noteId: note.id } },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    logger.error('[lead-notes.POST] unexpected error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', issues: parsed.error.issues }, { status: 400 });
    }

    const { leadId, tag, pinned, search, page, pageSize, sort } = parsed.data;
    const where: any = {
      AND: [
        leadId ? { leadId } : {},
        tag ? { tags: { has: tag } } : {},
        pinned === 'true' ? { pinned: true } : {},
        search ? { content: { contains: search, mode: 'insensitive' } } : {},
        {
          OR: [
            { authorId: session.user.id },
            { lead: { ownerId: session.user.id } },
            { lead: { sharedWith: { some: { userId: session.user.id } } } },
          ],
        },
      ],
    };

    const orderBy =
      sort === 'oldest' ? { createdAt: 'asc' as const } : sort === 'pinned' ? [{ pinned: 'desc' as const }, { createdAt: 'desc' as const }] : { createdAt: 'desc' as const };

    const [total, items, tagAgg] = await Promise.all([
      prisma.leadNote.count({ where }),
      prisma.leadNote.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.leadNote.groupBy({
        by: ['tags'],
        where: leadId ? { leadId, lead: { OR: [{ ownerId: session.user.id }, { sharedWith: { some: { userId: session.user.id } } }] } } : {},
        _count: { _all: true },
      }),
    ]);

    const tagCounts: Record<string, number> = {};
    for (const row of tagAgg) {
      for (const t of row.tags) tagCounts[t] = (tagCounts[t] ?? 0) + row._count._all;
    }

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      tagCounts,
    });
  } catch (err) {
    logger.error('[lead-notes.GET] unexpected error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

    const body = await req.json().catch(() => null);
    const parsed = leadNoteUpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const note = await prisma.leadNote.findFirst({
      where: { id, authorId: session.user.id },
      select: { id: true },
    });
    if (!note) return NextResponse.json({ error: 'Note not found or not editable' }, { status: 404 });

    const updated = await prisma.leadNote.update({
      where: { id },
      data: { ...parsed.data, editedAt: new Date() },
    });
    return NextResponse.json({ note: updated });
  } catch (err) {
    logger.error('[lead-notes.PATCH] unexpected error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

    const note = await prisma.leadNote.findFirst({
      where: { id, authorId: session.user.id },
      select: { id: true, leadId: true },
    });
    if (!note) return NextResponse.json({ error: 'Note not found or not deletable' }, { status: 404 });

    await prisma.leadNote.delete({ where: { id } });
    await prisma.leadActivity.create({
      data: { leadId: note.leadId, userId: session.user.id, type: 'NOTE_DELETED', payload: { noteId: id } },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[lead-notes.DELETE] unexpected error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
