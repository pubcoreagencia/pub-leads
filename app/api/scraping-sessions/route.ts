import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { createScrapingSession } from "@/src/lib/turso/scraping-sessions-repository";

const schema = z.object({
  city: z.string().trim().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  niche: z.string().trim().nullable().optional(),
  query: z.string().trim().nullable().optional(),
  requested_limit: z.number().int().positive().max(1000).nullable().optional(),
  source: z.string().trim().min(1),
  status: z.enum(["idle", "running", "completed", "failed", "cancelled"]).optional(),
});

async function getUserId() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function POST(request: Request) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Sessao de scraping invalida." }, { status: 400 });
  }

  const session = await createScrapingSession(userId, parsed.data);

  return NextResponse.json({ session });
}
