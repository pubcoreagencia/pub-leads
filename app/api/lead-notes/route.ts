import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =====================================================================
// pub-leads | Lead Notes API
// CRUD de anotações internas vinculadas a um lead específico.
// Squad: B2B Growth, Inteligência de Leads & Scraping
// =====================================================================

// ---- Tipos ------------------------------------------------------------
type LeadNote = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

type ApiResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown };

// ---- Cliente Supabase (lazy singleton) -------------------------------
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[lead-notes] Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.',
    );
  }
  _supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

// ---- Schemas Zod ------------------------------------------------------
const createNoteSchema = z.object({
  lead_id: z.string().uuid('lead_id deve ser um UUID válido'),
  content: z
    .string()
    .min(1, 'content é obrigatório')
    .max(4000, 'content excede 4000 caracteres'),
  tags: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  is_pinned: z.boolean().optional().default(false),
});

const updateNoteSchema = z.object({
  id: z.string().uuid('id deve ser um UUID válido'),
  content: z.string().min(1).max(4000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  is_pinned: z.boolean().optional(),
});

const listQuerySchema = z.object({
  lead_id: z.string().uuid(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  only_pinned: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true')
    .default('false'),
});

const deleteQuerySchema = z.object({
  id: z.string().uuid(),
});

// ---- Util: extrair usuário autenticado a partir do Bearer token ------
async function getAuthUser(req: NextRequest): Promise<{ id: string } | null> {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : null;
    if (!token) return null;
    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id };
  } catch {
    return null;
  }
}

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json<ApiResponse>(
    { ok: false, error, details },
    { status },
  );
}

function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, { status });
}

// =====================================================================
// GET  /api/lead-notes?lead_id=...&page=1&pageSize=20&only_pinned=false
// POST /api/lead-notes
// PATCH /api/lead-notes
// DELETE /api/lead-notes?id=...
// =====================================================================
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return jsonError(401, 'Não autenticado');

  const { searchParams } = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    lead_id: searchParams.get('lead_id') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    only_pinned: searchParams.get('only_pinned') ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, 'Parâmetros inválidos', parsed.error.flatten());
  }

  const { lead_id, page, pageSize, only_pinned } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = getSupabase()
    .from('lead_notes')
    .select('*', { count: 'exact' })
    .eq('lead_id', lead_id)
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (only_pinned) query = query.eq('is_pinned', true);

  const { data, error, count } = await query;
  if (error) return jsonError(500, 'Falha ao listar notas', error.message);

  return jsonOk({
    items: (data ?? []) as LeadNote[],
    page,
    pageSize,
    total: count ?? 0,
    hasMore: (count ?? 0) > to + 1,
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return jsonError(401, 'Não autenticado');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'JSON inválido');
  }

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, 'Payload inválido', parsed.error.flatten());
  }

  const { lead_id, content, tags, is_pinned } = parsed.data;

  // Garante que o lead pertence ao usuário (defesa em profundidade)
  const { data: lead, error: leadErr } = await getSupabase()
    .from('leads')
    .select('id')
    .eq('id', lead_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (leadErr) return jsonError(500, 'Falha ao validar lead', leadErr.message);
  if (!lead) return jsonError(404, 'Lead não encontrado para este usuário');

  const { data, error } = await getSupabase()
    .from('lead_notes')
    .insert({
      lead_id,
      user_id: user.id,
      content: content.trim(),
      tags,
      is_pinned,
    })
    .select('*')
    .single();

  if (error) return jsonError(500, 'Falha ao criar nota', error.message);
  return jsonOk<LeadNote>(data as LeadNote, 201);
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return jsonError(401, 'Não autenticado');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'JSON inválido');
  }

  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, 'Payload inválido', parsed.error.flatten());
  }

  const { id, ...patch } = parsed.data;
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.content !== undefined) updatePayload.content = patch.content.trim();
  if (patch.tags !== undefined) updatePayload.tags = patch.tags;
  if (patch.is_pinned !== undefined) updatePayload.is_pinned = patch.is_pinned;

  const { data, error } = await getSupabase()
    .from('lead_notes')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle();

  if (error) return jsonError(500, 'Falha ao atualizar nota', error.message);
  if (!data) return jsonError(404, 'Nota não encontrada');
  return jsonOk<LeadNote>(data as LeadNote);
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return jsonError(401, 'Não autenticado');

  const { searchParams } = new URL(req.url);
  const parsed = deleteQuerySchema.safeParse({
    id: searchParams.get('id') ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, 'Parâmetros inválidos', parsed.error.flatten());
  }

  const { error } = await getSupabase()
    .from('lead_notes')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', user.id);

  if (error) return jsonError(500, 'Falha ao deletar nota', error.message);
  return jsonOk({ id: parsed.data.id, deleted: true });
}

// ---- Configuração de rota --------------------------------------------
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
