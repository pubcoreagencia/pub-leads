import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * Lead Notes API — pub-leads
 * Operações: GET (listar), POST (criar) notas vinculadas a leads com audit trail.
 * Inclui:
 *  - Validação com Zod
 *  - Rate limiting por IP+rota
 *  - Auditoria (created_by/updated_by/timestamps)
 *  - Soft delete (não remove fisicamente)
 *  - Filtros por lead_id, author_id, pin flag
 */

const createNoteSchema = z.object({
  lead_id: z.string().uuid('lead_id deve ser um UUID válido'),
  content: z
    .string()
    .min(1, 'conteúdo obrigatório')
    .max(5000, 'conteúdo excede 5000 caracteres'),
  pinned: bool = false,
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
});

const querySchema = z.object({
  lead_id: z.string().uuid().optional(),
  author_id: z.string().uuid().optional(),
  pinned: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

const limiter = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'lead-notes' });

export async function GET(req: NextRequest) {
  const rl = limiter.check(req);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_ms: rl.retryAfterMs },
      { status: 429 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_query', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { lead_id, author_id, pinned, limit, cursor } = parsed.data;

    let query = supabase
      .from('lead_notes')
      .select(
        'id, lead_id, author_id, content, pinned, tags, created_at, updated_at, deleted_at',
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (lead_id) query = query.eq('lead_id', lead_id);
    if (author_id) query = query.eq('author_id', author_id);
    if (typeof pinned === 'boolean') query = query.eq('pinned', pinned);
    if (cursor) query = query.lt('created_at', cursor);

    const { data, error, count } = await query;
    if (error) {
      logger.error('lead_notes.list.error', { error });
      return NextResponse.json(
        { error: 'db_error', message: error.message },
        { status: 500 }
      );
    }

    const next_cursor =
      data && data.length === limit ? data[data.length - 1].created_at : null;

    return NextResponse.json(
      { items: data, total: count, next_cursor },
      { status: 200, headers: { 'Cache-Control': 'private, max-age=10' } }
    );
  } catch (err) {
    logger.error('lead_notes.list.unhandled', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = limiter.check(req);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_ms: rl.retryAfterMs },
      { status: 429 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Confirma que o lead pertence à organização do usuário
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, organization_id')
      .eq('id', parsed.data.lead_id)
      .is('deleted_at', null)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json(
        { error: 'lead_not_found', lead_id: parsed.data.lead_id },
        { status: 404 }
      );
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', lead.organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: 'forbidden', reason: 'not_member_of_lead_org' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const { data: note, error } = await supabase
      .from('lead_notes')
      .insert({
        lead_id: parsed.data.lead_id,
        author_id: user.id,
        content: parsed.data.content.trim(),
        pinned: parsed.data.pinned ?? false,
        tags: parsed.data.tags ?? [],
        created_by: user.id,
        updated_by: user.id,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !note) {
      logger.error('lead_notes.create.error', { error });
      return NextResponse.json(
        { error: 'db_error', message: error?.message },
        { status: 500 }
      );
    }

    // Audit trail
    await supabase.from('audit_events').insert({
      actor_id: user.id,
      organization_id: lead.organization_id,
      entity_type: 'lead_note',
      entity_id: note.id,
      action: 'create',
      metadata: { lead_id: parsed.data.lead_id, pinned: note.pinned },
      created_at: now,
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    logger.error('lead_notes.create.unhandled', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
