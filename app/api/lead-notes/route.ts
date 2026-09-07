import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leadNotes, leads } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const createNoteSchema = z.object({
  leadId: z.string().uuid('leadId deve ser um UUID válido'),
  content: z.string().min(1, 'Conteúdo obrigatório').max(5000, 'Máximo 5000 caracteres'),
  type: z.enum(['general', 'call', 'meeting', 'follow_up', 'important']).default('general'),
  metadata: z.record(z.unknown()).optional(),
});

const updateNoteSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(5000).optional(),
  type: z.enum(['general', 'call', 'meeting', 'follow_up', 'important']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const querySchema = z.object({
  leadId: z.string().uuid().optional(),
  type: z.enum(['general', 'call', 'meeting', 'follow_up', 'important']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { leadId, type, limit, offset } = parsed.data;

    const conditions = [];
    if (leadId) conditions.push(eq(leadNotes.leadId, leadId));
    if (type) conditions.push(eq(leadNotes.type, type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const notes = await db
      .select({
        id: leadNotes.id,
        leadId: leadNotes.leadId,
        content: leadNotes.content,
        type: leadNotes.type,
        metadata: leadNotes.metadata,
        createdAt: leadNotes.createdAt,
        updatedAt: leadNotes.updatedAt,
      })
      .from(leadNotes)
      .where(whereClause)
      .orderBy(desc(leadNotes.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leadNotes)
      .where(whereClause);

    return NextResponse.json({
      success: true,
      data: notes,
      pagination: { total: count, limit, offset, hasMore: offset + notes.length < count },
    });
  } catch (error) {
    console.error('[lead-notes GET]', error);
    return NextResponse.json({ error: 'Erro interno ao listar notas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { leadId, content, type, metadata } = parsed.data;

    const leadExists = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (leadExists.length === 0) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const noteId = nanoid();
    const newNote = {
      id: noteId,
      leadId,
      userId: session.user.id,
      content,
      type,
      metadata: metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(leadNotes).values(newNote);

    await db
      .update(leads)
      .set({
        lastContactAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    return NextResponse.json({ success: true, data: newNote }, { status: 201 });
  } catch (error) {
    console.error('[lead-notes POST]', error);
    return NextResponse.json({ error: 'Erro interno ao criar nota' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, content, type, metadata } = parsed.data;

    const existing = await db
      .select()
      .from(leadNotes)
      .where(eq(leadNotes.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 });
    }

    const note = existing[0];
    if (note.userId !== session.user.id) {
      return NextResponse.json({ error: 'Sem permissão para editar esta nota' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (content !== undefined) updates.content = content;
    if (type !== undefined) updates.type = type;
    if (metadata !== undefined) updates.metadata = metadata;

    await db.update(leadNotes).set(updates).where(eq(leadNotes.id, id));

    const updated = await db.select().from(leadNotes).where(eq(leadNotes.id, id)).limit(1);

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('[lead-notes PATCH]', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar nota' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(leadNotes)
      .where(eq(leadNotes.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 });
    }

    if (existing[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Sem permissão para deletar esta nota' }, { status: 403 });
    }

    await db.delete(leadNotes).where(eq(leadNotes.id, id));

    return NextResponse.json({ success: true, message: 'Nota deletada com sucesso' });
  } catch (error) {
    console.error('[lead-notes DELETE]', error);
    return NextResponse.json({ error: 'Erro interno ao deletar nota' }, { status: 500 });
  }
}
