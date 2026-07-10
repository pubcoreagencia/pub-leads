import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { LeadFormValues } from "@/schemas/lead";
import { leadFormSchema } from "@/schemas/lead";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { deleteLead, getLeadById, updateLead } from "@/src/lib/turso/leads-repository";
import type { LeadUpdateInput } from "@/src/lib/turso/types";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function formToLeadUpdate(values: LeadFormValues): LeadUpdateInput {
  const phone = cleanOptional(values.phone);
  const whatsapp = cleanOptional(values.whatsapp);

  return {
    address: cleanOptional(values.address),
    business_name: cleanOptional(values.company),
    category: cleanOptional(values.category),
    city: cleanOptional(values.city),
    country: cleanOptional(values.country),
    email: cleanOptional(values.email),
    name: values.name.trim(),
    phone,
    phone_2: null,
    source: values.source,
    state: cleanOptional(values.state),
    status: values.status,
    website: cleanOptional(values.website),
    whatsapp,
  };
}

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

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Lead invalido." }, { status: 400 });
  }

  const lead = await getLeadById(userId, parsedParams.data.leadId);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ lead });
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
    leadFormSchema.safeParseAsync(await request.json()),
  ]);

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Lead invalido." }, { status: 400 });
  }

  const lead = await updateLead(userId, parsedParams.data.leadId, formToLeadUpdate(parsedBody.data));

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

export async function DELETE(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Lead invalido." }, { status: 400 });
  }

  const deleted = await deleteLead(userId, parsedParams.data.leadId);

  if (!deleted) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
