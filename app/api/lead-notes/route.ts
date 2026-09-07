import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================

const createNoteSchema = z.object({
  leadId: z.string().cuid("leadId inválido"),
  content: z
    .string()
    .min(1, "Conteúdo não pode ser vazio")
    .max(5000, "Conteúdo excede 5000 caracteres")
    .transform((v) => v.trim()),
  type: z
    .enum(["GENERAL", "CALL", "MEETING", "FOLLOW_UP", "IMPORTANT", "NEGOTIATION"])
    .default("GENERAL"),
  pinned: z.boolean().optional().default(false),
  reminderAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
});

const updateNoteSchema = z.object({
  content: z
    .string()
    .min(1, "Conteúdo não pode ser vazio")
    .max(5000)
    .transform((v) => v.trim())
    .optional(),
  type: z
    .enum(["GENERAL", "CALL", "MEETING", "FOLLOW_UP", "IMPORTANT", "NEGOTIATION"])
    .optional(),
  pinned: z.boolean().optional(),
  reminderAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
});

const querySchema = z.object({
  leadId: z.string().cuid().optional(),
  type: z
    .enum(["GENERAL", "CALL", "MEETING", "FOLLOW_UP", "IMPORTANT", "NEGOTIATION"])
    .optional(),
  pinned: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z
    .string()
    .default("1")
    .transform((v) => parseInt(v, 10))
    .refine((n) => !isNaN(n) && n > 0, "page inválida"),
  pageSize: z
    .string()
    .default("20")
    .transform((v) => parseInt(v, 10))
    .refine((n) => !isNaN(n) && n > 0 && n <= 100, "pageSize inválida (1-100)"),
  search: z.string().max(200).optional(),
});

// ============================================================================
// Helpers
// ============================================================================

async function ensureLeadOwnership(leadId: string, userId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, userId },
    select: { id: true, name: true },
  });
  return lead;
}

async function ensureNoteOwnership(noteId: string, userId: string) {
  return prisma.leadNote.findFirst({
    where: { id: noteId, userId },
  });
}

// ============================================================================
// GET /api/lead-notes - List notes (paginated, filtered)
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const limiter = rateLimit({
      key: `lead-notes:list:${session.user.id}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Limite de requisições excedido" },
        { status: 429 }
      );
    }

    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { leadId, type, pinned, page, pageSize, search } = parsed.data;

    if (leadId) {
      const lead = await ensureLeadOwnership(leadId, session.user.id);
      if (!lead) {
        return NextResponse.json(
          { error: "Lead não encontrado ou sem permissão" },
          { status: 404 }
        );
      }
    }

    const where: any = { userId: session.user.id };
    if (leadId) where.leadId = leadId;
    if (type) where.type = type;
    if (typeof pinned === "boolean") where.pinned = pinned;
    if (search) {
      where.content = { contains: search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.leadNote.findMany({
        where,
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          lead: {
            select: { id: true, name: true, email: true, company: true },
          },
        },
      }),
      prisma.leadNote.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
      },
    });
  } catch (err) {
    console.error("[GET /api/lead-notes]", err);
    return NextResponse.json(
      { error: "Erro interno ao listar notas" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/lead-notes - Create note
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const limiter = rateLimit({
      key: `lead-notes:create:${session.user.id}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Limite de criação excedido" },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const lead = await ensureLeadOwnership(parsed.data.leadId, session.user.id);
    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado ou sem permissão" },
        { status: 404 }
      );
    }

    const note = await prisma.leadNote.create({
      data: {
        userId: session.user.id,
        leadId: parsed.data.leadId,
        content: parsed.data.content,
        type: parsed.data.type,
        pinned: parsed.data.pinned,
        reminderAt: parsed.data.reminderAt,
      },
      include: {
        lead: { select: { id: true, name: true, email: true, company: true } },
      },
    });

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/lead-notes]", err);
    return NextResponse.json(
      { error: "Erro interno ao criar nota" },
      { status: 500 }
    );
  }
}
