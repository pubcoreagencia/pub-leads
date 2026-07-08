import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { leadStatusSchema } from "@/schemas/lead";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { updateLeadStatus } from "@/src/lib/turso/leads-repository";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

const statusSchema = z.object({
  status: leadStatusSchema,
});

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const [parsedParams, parsedBody] = await Promise.all([
    paramsSchema.safeParseAsync(await context.params),
    statusSchema.safeParseAsync(await request.json()),
  ]);

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  const lead = await updateLeadStatus(userId, parsedParams.data.leadId, parsedBody.data.status);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ lead });
}
