import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const NoteSchema = z.object({
  leadId: z.string().uuid('leadId deve ser um UUID válido'),
  content: z.string().min(1, 'conteúdo obrigatório').max(5000),
  type: z.enum(['observation', 'call', 'email', 'meeting', 'status_change']).default('observation'),
  metadata: z.record(z.any()).optional(),
});

const QuerySchema = z.object({
  leadId: z.string().uuid().optional(),
  type: z.enum(['observation', 'call', 'email', 'meeting', 'status_change']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { leadId, type, limit, offset } = parsed.data;
    let query = supabase
      .from('lead_notes')
      .select('*, author:users(id, name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (leadId) query = query.eq('lead_id', leadId);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: { total: count, limit, offset },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro interno ao listar notas' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = NoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { leadId, content, type, metadata } = parsed.data;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, status')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const { data: note, error } = await supabase
      .from('lead_notes')
      .insert({
        lead_id: leadId,
        author_id: userData.user.id,
        content,
        type,
        metadata: metadata || {},
      })
      .select('*, author:users(id, name, email)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (type === 'status_change' && metadata?.newStatus) {
      await supabase
        .from('leads')
        .update({ status: metadata.newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);
    }

    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro interno ao criar nota' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('id');
    if (!noteId) {
      return NextResponse.json({ error: 'id da nota é obrigatório' }, { status: 400 });
    }

    const UpdateSchema = NoteSchema.partial();
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (parsed.data.content) updates.content = parsed.data.content;
    if (parsed.data.type) updates.type = parsed.data.type;
    if (parsed.data.metadata) updates.metadata = parsed.data.metadata;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('lead_notes')
      .update(updates)
      .eq('id', noteId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro interno ao atualizar nota' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('id');
    if (!noteId) {
      return NextResponse.json({ error: 'id da nota é obrigatório' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lead_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro interno ao deletar nota' },
      { status: 500 }
    );
  }
}
