import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * pub-leads :: Lead Notes API
 * -----------------------
 * CRUD minimalista para anotações internas sobre leads B2B.
 * Persistência em memória (substituível por Postgres/Prisma depois).
 * Ideal para uso em timeline / activity feed do lead.
 */

// Em produção, substituir por Prisma + Postgres. Aqui mantemos em memória
// para viabilizar testes locais sem dependência de banco.
type LeadNote = {
  id: string;
  leadId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

// Singleton em escopo de módulo (sobrevive entre requests no mesmo processo)
declare global {
  // eslint-disable-next-line no-var
  var __pubLeadsNotesStore: Map<string, LeadNote[]> | undefined;
}

const store: Map<string, LeadNote[]> =
  globalThis.__pubLeadsNotesStore ?? new Map<string, LeadNote[]>();
if (!globalThis.__pubLeadsNotesStore) {
  globalThis.__pubLeadsNotesStore = store;
}

const noteSchema = z.object({
  leadId: z.string().min(1, 'leadId obrigatório'),
  authorId: z.string().min(1, 'authorId obrigatório'),
  content: z.string().min(1, 'conteúdo vazio não é permitido').max(5000),
});

const updateSchema = z.object({
  content: z.string().min(1).max(5000),
});

function getUserIdFromRequest(req: NextRequest): string | null {
  // Placeholder: em produção extrair de sessão/JWT. Aqui aceitamos header.
  return req.headers.get('x-user-id');
}

function ensureList(leadId: string): LeadNote[] {
  let list = store.get(leadId);
  if (!list) {
    list = [];
    store.set(leadId, list);
  }
  return list;
}

function genId(): string {
  // Compatível com ambiente edge.
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

/**
 * GET /api/lead-notes?leadId=xxx
 * Lista todas as notas de um lead em ordem cronológica decrescente.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('leadId');

  if (!leadId) {
    return NextResponse.json(
      { error: 'Parâmetro "leadId" é obrigatório.' },
      { status: 400 },
    );
  }

  const notes = ensureList(leadId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ leadId, count: notes.length, notes });
}

/**
 * POST /api/lead-notes
 * Body: { leadId, authorId, content }
 */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Header "x-user-id" ausente. Não autorizado.' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido.', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // Autoridade: o authorId enviado deve bater com o usuário autenticado.
  if (parsed.data.authorId !== userId) {
    return NextResponse.json(
      { error: 'authorId não corresponde ao usuário autenticado.' },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const note: LeadNote = {
    id: genId(),
    leadId: parsed.data.leadId,
    authorId: parsed.data.authorId,
    content: parsed.data.content.trim(),
    createdAt: now,
    updatedAt: now,
  };

  ensureList(parsed.data.leadId).push(note);

  return NextResponse.json({ note }, { status: 201 });
}

/**
 * PATCH /api/lead-notes?id=xxx
 * Body: { content }
 */
export async function PATCH(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Header "x-user-id" ausente. Não autorizado.' },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: 'Parâmetro "id" é obrigatório.' },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido.', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  for (const list of store.values()) {
    const idx = list.findIndex((n) => n.id === id);
    if (idx >= 0) {
      const existing = list[idx];
      if (existing.authorId !== userId) {
        return NextResponse.json(
          { error: 'Sem permissão para editar esta nota.' },
          { status: 403 },
        );
      }
      const updated: LeadNote = {
        ...existing,
        content: parsed.data.content.trim(),
        updatedAt: new Date().toISOString(),
      };
      list[idx] = updated;
      return NextResponse.json({ note: updated });
    }
  }

  return NextResponse.json(
    { error: 'Nota não encontrada.' },
    { status: 404 },
  );
}

/**
 * DELETE /api/lead-notes?id=xxx
 */
export async function DELETE(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Header "x-user-id" ausente. Não autorizado.' },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: 'Parâmetro "id" é obrigatório.' },
      { status: 400 },
    );
  }

  for (const list of store.values()) {
    const idx = list.findIndex((n) => n.id === id);
    if (idx >= 0) {
      const existing = list[idx];
      if (existing.authorId !== userId) {
        return NextResponse.json(
          { error: 'Sem permissão para remover esta nota.' },
          { status: 403 },
        );
      }
      list.splice(idx, 1);
      return NextResponse.json({ ok: true, id });
    }
  }

  return NextResponse.json(
    { error: 'Nota não encontrada.' },
    { status: 404 },
  );
}
