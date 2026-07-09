import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { LeadFormValues } from "@/schemas/lead";
import { leadFormSchema, leadSourceSchema, leadStatusSchema } from "@/schemas/lead";
import { hasTursoConfig, getTursoUnavailableMessage } from "@/src/lib/turso/client";
import { createLead, deleteLeads, listLeads } from "@/src/lib/turso/leads-repository";
import type { LeadWriteInput } from "@/src/lib/turso/types";

const listSchema = z.object({
  category: z.string().trim().optional(),
  city: z.string().trim().optional(),
  name: z.string().trim().optional(),
  onlyWithPhone: z.enum(["true", "false"]).optional(),
  qualification: z
    .enum(["all", "with_whatsapp", "without_whatsapp", "with_instagram", "without_instagram"])
    .optional(),
  site: z.enum(["all", "with_site", "without_site"]).optional(),
  source: z.union([leadSourceSchema, z.literal("all")]).optional(),
  status: z.union([leadStatusSchema, z.literal("all")]).optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function formToLeadInput(values: LeadFormValues): LeadWriteInput {
  const phone = cleanOptional(values.phone);
  const whatsapp = cleanOptional(values.whatsapp);

  return {
    address: cleanOptional(values.address),
    business_name: cleanOptional(values.company),
    category: cleanOptional(values.category),
    city: cleanOptional(values.city),
    country: cleanOptional(values.country),
    email: cleanOptional(values.email),
    fantasy_name: null,
    name: values.name.trim(),
    phone: phone ?? whatsapp,
    phone_2: phone && whatsapp && phone !== whatsapp ? whatsapp : null,
    raw_data: {},
    source: values.source,
    state: cleanOptional(values.state),
    status: values.status,
    website: cleanOptional(values.website),
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

export async function GET(request: Request) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ error: "Filtros invalidos." }, { status: 400 });
  }

  const leads = await listLeads(userId, {
    category: parsed.data.category || undefined,
    city: parsed.data.city || undefined,
    name: parsed.data.name || undefined,
    onlyWithPhone: parsed.data.onlyWithPhone === "true",
    qualification: parsed.data.qualification,
    site: parsed.data.site,
    source: parsed.data.source,
    status: parsed.data.status,
  });

  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = leadFormSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Lead invalido." }, { status: 400 });
  }

  const lead = await createLead(userId, formToLeadInput(parsed.data));

  return NextResponse.json({ lead });
}

export async function DELETE(request: Request) {
  if (!hasTursoConfig()) {
    return NextResponse.json({ error: getTursoUnavailableMessage() }, { status: 503 });
  }

  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Lista de leads invalida." }, { status: 400 });
  }

  const deletedCount = await deleteLeads(userId, parsed.data.ids);

  return NextResponse.json({ deletedCount });
}
