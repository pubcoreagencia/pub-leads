import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Lead Notes API Route
 * 
 * Endpoints:
 * - GET  /api/lead-notes         -> List notes (paginated, filterable by leadId)
 * - POST /api/lead-notes         -> Create a new note attached to a lead
 * - PATCH/DELETE handled in [id]/route.ts (future route)
 *
 * Storage: In-memory store for the prototype. Replace with Prisma/Drizzle/Postgres
 * when wiring the real database.
 */

// ---------- Types ----------
interface LeadNote {
  id: string;
  leadId: string;
  authorId: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- In-Memory Store ----------
const store: Map<string, LeadNote> = (() => {
  const globalKey = '__pub_leads_notes_store__';
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[globalKey]) {
    const m = new Map<string, LeadNote>();
    // Seed with one example note to make the endpoint immediately useful.
    const now = new Date().toISOString();
    m.set('seed_1', {
      id: 'seed_1',
      leadId: 'demo-lead',
      authorId: 'system',
      body: 'Lead demonstrativo importado via scraping.',
      tags: ['demo', 'scraping'],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
    g[globalKey] = m;
  }
  return g[globalKey] as Map<string, LeadNote>;
})();

// ---------- Validation Schemas ----------
const createNoteSchema = z.object({
  leadId: z.string().min(1, 'leadId is required').max(128),
  authorId: z.string().min(1, 'authorId is required').max(128),
  body: z.string().min(1, 'body cannot be empty').max(4000),
  tags: z.array(z.string().min(1).max(32)).max(20).optional().default([]),
  pinned: z.boolean().optional().default(false),
});

const listQuerySchema = z.object({
  leadId: z.string().min(1).optional(),
  authorId: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  pinned: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .default('1')
    .transform((v) => Math.max(1, parseInt(v, 10))),
  pageSize: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .default('20')
    .transform((v) => Math.min(100, Math.max(1, parseInt(v, 10)))),
});

// ---------- Helpers ----------
function generateId(): string {
  // Lightweight RFC4122-ish identifier without external deps.
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    data: items.slice(start, end),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, details },
    { status }
  );
}

function jsonOk<T>(data: T, status = 200, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: true, data, ...(extra ?? {}) },
    { status }
  );
}

// ---------- Handlers ----------
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
      return jsonError('Invalid query parameters', 400, parsed.error.flatten());
    }

    const { leadId, authorId, tag, pinned, page, pageSize } = parsed.data;

    let notes = Array.from(store.values());

    if (leadId) notes = notes.filter((n) => n.leadId === leadId);
    if (authorId) notes = notes.filter((n) => n.authorId === authorId);
    if (typeof pinned === 'boolean') notes = notes.filter((n) => n.pinned === pinned);
    if (tag) notes = notes.filter((n) => n.tags.includes(tag));

    // Pinned first, then most recent.
    notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const result = paginate(notes, page, pageSize);
    return jsonOk(result.data, 200, { pagination: result.pagination });
  } catch (err) {
    return jsonError(
      'Internal error while listing notes',
      500,
      err instanceof Error ? { message: err.message } : undefined
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Request body must be a JSON object', 400);
    }

    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid note payload', 422, parsed.error.flatten());
    }

    const { leadId, authorId, body: noteBody, tags, pinned } = parsed.data;
    const now = new Date().toISOString();

    const note: LeadNote = {
      id: generateId(),
      leadId,
      authorId,
      body: noteBody.trim(),
      tags: Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))),
      pinned,
      createdAt: now,
      updatedAt: now,
    };

    store.set(note.id, note);

    return jsonOk(note, 201);
  } catch (err) {
    return jsonError(
      'Internal error while creating note',
      500,
      err instanceof Error ? { message: err.message } : undefined
    );
  }
}

// ---------- Route Config ----------
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
