import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const CreateNoteSchema = z.object({
  leadId: z.string().min(1, 'leadId obrigatório'),
  content: z.string().min(1, 'conteúdo obrigatório').max(5000),
  type: z.enum(['GENERAL', 'CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP']).default('GENERAL'),
  pinned: z.boolean().optional().default(false),
});

const UpdateNoteSchema = z.object({
  noteId: z.string().min(1),
  content: z.string().min(1).max(5000).optional(),
  type: z.enum(['GENERAL', 'CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP']).optional(),
  pinned: z.boolean().optional(),
});

const DeleteNoteSchema = z.object({
  noteId: z.string().min(1),
});

const ListNotesQuerySchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(['GENERAL', 'CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP']).optional(),
  pinned: z.string().optional().transform((v) => v === 'true'),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
});

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, email: session.user.email };
}

async function ensureLeadOwnership(userId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ownerId: userId },
    select: { id: true },
  });
  return !!lead;
}

async function ensureNoteOwnership(userId: string, noteId: string) {
  const note = await prisma.leadNote.findFirst({
    where: { id: noteId, authorId: userId },
    select: { id: true, leadId: true },
  });
  return note;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = ListNotesQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Parâmetros inválidos', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { leadId, type, pinned, page, limit } = parsed.data;

  const owns = await ensureLeadOwnership(user.id, leadId);
  if (!owns) {
    return NextResponse.json({ error: 'Lead não encontrado ou sem permissão' }, { status: 404 });
  }

  const where = {
    leadId,
    authorId: user.id,
    ...(type ? { type } : {}),
    ...(typeof pinned === 'boolean' ? { pinned } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.leadNote.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        content: true,
        type: true,
        pinned: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.leadNote.count({ where }),
  ]);

  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { leadId, content, type, pinned } = parsed.data;

  const owns = await ensureLeadOwnership(user.id, leadId);
  if (!owns) {
    return NextResponse.json({ error: 'Lead não encontrado ou sem permissão' }, { status: 404 });
  }

  const note = await prisma.leadNote.create({
    data: {
      leadId,
      authorId: user.id,
      content: content.trim(),
      type,
      pinned,
    },
    select: {
      id: true,
      content: true,
      type: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(note, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = UpdateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { noteId, content, type, pinned } = parsed.data;

  const existing = await ensureNoteOwnership(user.id, noteId);
  if (!existing) {
    return NextResponse.json({ error: 'Nota não encontrada ou sem permissão' }, { status: 404 });
  }

  const note = await prisma.leadNote.update({
    where: { id: noteId },
    data: {
      ...(content !== undefined ? { content: content.trim() } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(pinned !== undefined ? { pinned } : {}),
    },
    select: {
      id: true,
      content: true,
      type: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(note);
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = DeleteNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { noteId } = parsed.data;

  const existing = await ensureNoteOwnership(user.id, noteId);
  if (!existing) {
    return NextResponse.json({ error: 'Nota não encontrada ou sem permissão' }, { status: 404 });
  }

  await prisma.leadNote.delete({ where: { id: noteId } });

  return NextResponse.json({ success: true, id: noteId });
}
