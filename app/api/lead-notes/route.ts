import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const NoteSchema = z.object({
  leadId: z.string().uuid('leadId deve ser um UUID válido'),
  content: z.string().min(1, 'conteúdo obrigatório').max(5000),
  type: z.enum(['observation', 'call', 'email', 'meeting', 'task']).default('observation'),
  metadata: z.record(z.unknown()).optional(),
});

const QuerySchema = z.object({
  leadId: z.string().uuid().optional(),
  type: z.enum(['observation', 'call', 'email', 'meeting', 'task']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  includeDeleted: z.coerce.boolean().default(false),
});

function getUserId(req: NextRequest): string | null {
  const userId = req.headers.get('x-user-id');
  return userId && userId.trim().length > 0 ? userId : null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const params = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const { leadId, type, page, pageSize, includeDeleted } = params;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('lead_notes')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (leadId) query = query.eq('lead_id', leadId);
    if (type) query = query.eq('type', type);
    if (!includeDeleted) query = query.is('deleted_at', null);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data ?? [],
      pagination: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'validation_error', issues: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'internal_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = NoteSchema.parse(body);

    const { data, error } = await supabase
      .from('lead_notes')
      .insert({
        user_id: userId,
        lead_id: parsed.leadId,
        content: parsed.content,
        type: parsed.type,
        metadata: parsed.metadata ?? {},
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'validation_error', issues: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'internal_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { id, content, metadata } = await req.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof content === 'string' && content.trim().length > 0) update.content = content;
    if (metadata && typeof metadata === 'object') update.metadata = metadata;

    const { data, error } = await supabase
      .from('lead_notes')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lead_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
