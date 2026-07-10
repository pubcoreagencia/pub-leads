import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadFormValues } from "@/schemas/lead";
import { leadFormSchema } from "@/schemas/lead";
import { extractInstagramFromTextOrUrl } from "@/src/lib/lead-qualification/qualifier";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { deleteLead, getLeadById, updateLead } from "@/src/lib/turso/leads-repository";
import type { JsonRecord, LeadUpdateInput } from "@/src/lib/turso/types";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function normalizeInstagramProfile(value: string | null) {
  if (!value) {
    return null;
  }

  const found = extractInstagramFromTextOrUrl(value);

  if (found) {
    return found;
  }

  const handle = value.replace(/^@/, "").trim();

  if (!/^[A-Za-z0-9._]{2,30}$/.test(handle)) {
    return null;
  }

  return { handle, url: `https://www.instagram.com/${handle}/` };
}

function withManualInstagram(rawData: JsonRecord, value: string | undefined) {
  const instagram = normalizeInstagramProfile(cleanOptional(value));
  const next: JsonRecord = { ...rawData };

  if (!instagram) {
    delete next.instagram_checked_at;
    delete next.instagram_handle;
    delete next.instagram_source;
    delete next.instagram_url;
    return next;
  }

  return {
    ...next,
    instagram_checked_at: new Date().toISOString(),
    instagram_handle: instagram.handle,
    instagram_source: "manual",
    instagram_url: instagram.url,
  };
}

function formToLeadUpdate(values: LeadFormValues, currentLead: Lead): LeadUpdateInput {
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
    raw_data: withManualInstagram(currentLead.metadata, values.instagram),
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

  const currentLead = await getLeadById(userId, parsedParams.data.leadId);

  if (!currentLead) {
    return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
  }

  const lead = await updateLead(userId, parsedParams.data.leadId, formToLeadUpdate(parsedBody.data, currentLead));

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
