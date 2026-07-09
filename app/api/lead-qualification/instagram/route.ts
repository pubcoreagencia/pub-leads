import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { discoverContactsFromWebsite } from "@/src/lib/lead-qualification/contact-enrichment";
import {
  buildQualificationTags,
  calculateQualificationScore,
  mergeQualificationIntoRawData,
  qualifyLeadAfterScraping,
  type LeadQualification,
} from "@/src/lib/lead-qualification/qualifier";

const qualificationLeadSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  phone: z.string().nullable().optional(),
  phone2: z.string().nullable().optional(),
  phone_2: z.string().nullable().optional(),
  qualification: z.record(z.string(), z.unknown()).nullable().optional(),
  raw: z.record(z.string(), z.unknown()).nullable().optional(),
  rawData: z.record(z.string(), z.unknown()).nullable().optional(),
  website: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
});

const requestSchema = z.object({
  leads: z.array(qualificationLeadSchema).min(1).max(25),
});

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));

  return results;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Leads invalidos para qualificacao." }, { status: 400 });
  }

  const results = await mapWithConcurrency(parsed.data.leads, 3, async (lead) => {
    const base = qualifyLeadAfterScraping(lead).qualification;
    const contact = await discoverContactsFromWebsite(lead.website);
    const instagramFound =
      contact.instagram_status === "found" ||
      (base.instagram_status === "found" && Boolean(base.instagram_url || base.instagram_handle));
    const instagramStatus = instagramFound
      ? "found"
      : contact.instagram_status === "unknown"
        ? base.instagram_status
        : contact.instagram_status;
    const whatsappStatus = contact.whatsapp_status === "confirmed" ? "confirmed" : base.whatsapp_status;
    const qualificationWithoutScore = {
      ...base,
      instagram_checked_at: contact.instagram_checked_at ?? base.instagram_checked_at,
      instagram_handle: contact.instagram_handle ?? base.instagram_handle,
      instagram_status: instagramStatus,
      instagram_url: contact.instagram_url ?? base.instagram_url,
      qualification_tags: buildQualificationTags({
        instagram_status: instagramStatus,
        whatsapp_status: whatsappStatus,
      }),
      whatsapp_checked_at:
        contact.whatsapp_status === "confirmed" ? contact.whatsapp_checked_at : base.whatsapp_checked_at,
      whatsapp_status: whatsappStatus,
    } satisfies Omit<LeadQualification, "qualification_score">;
    const qualification: LeadQualification = {
      ...qualificationWithoutScore,
      qualification_score: calculateQualificationScore(qualificationWithoutScore),
    };
    const rawData = mergeQualificationIntoRawData(
      {
        ...(lead.rawData ?? lead.raw ?? {}),
        contact_enrichment: contact,
        enrichment_checked_at: contact.enrichment_checked_at,
        enrichment_source: contact.enrichment_source,
      },
      qualification,
    );

    return {
      email: contact.email,
      id: lead.id,
      phone: contact.phone,
      qualification,
      rawData,
    };
  });

  return NextResponse.json({ results });
}
