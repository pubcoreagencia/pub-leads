import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const NoteSchema = z.object({
  lead_id: z.string().uuid(),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string()).optional().default([]),
  is_pinned: z.boolean().optional().default(false),
});

const UpdateSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  tags: z.array(z.string()).optional(),
  is_pinned: z.boolean().optional(),
});

const QuerySchema = z.object({
  lead_id: z.string().uuid().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  pinned_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

async function getUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const token = auth.replace('Bearer ', '');
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id || null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
    }

    const { lead_id, tag, search, pinned_only, limit, offset } = parsed.data;
    let query = supabase
      .from('lead_notes')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (lead_id) query = query.eq('lead_id', lead_id);
    if (pinned_only) query = query.eq('is_pinned', true);
    if (tag) query = query.contains('tags', [tag]);
    if (search) query = query.ilike('content', `%${search}%`);

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: data, total: count, limit, offset });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = NoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { lead_id, content, tags, is_pinned } = parsed.data;

    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', lead_id)
      .eq('user_id', userId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found or access denied' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('lead_notes')
      .insert({
        user_id: userId,
        lead_id,
        content,
        tags,
        is_pinned,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Note id is required' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lead_notes')
      .update(parsed.data)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note: data });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Note id is required' }, { status: 400 });
    }

    const { error, count } = await supabase
      .from('lead_notes')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!count) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
