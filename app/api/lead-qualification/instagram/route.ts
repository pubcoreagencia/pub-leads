import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { discoverInstagramFromWebsite } from "@/src/lib/lead-qualification/instagram-discovery";
import {
  buildQualificationTags,
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
    const instagram = await discoverInstagramFromWebsite(lead.website);
    const qualification: LeadQualification = {
      ...base,
      instagram_checked_at: instagram.instagram_checked_at,
      instagram_handle: instagram.instagram_handle,
      instagram_status: instagram.instagram_status,
      instagram_url: instagram.instagram_url,
      qualification_tags: buildQualificationTags({
        instagram_status: instagram.instagram_status,
        whatsapp_status: base.whatsapp_status,
      }),
    };
    qualification.qualification_score =
      (qualification.whatsapp_status === "confirmed"
        ? 50
        : qualification.whatsapp_status === "possible"
          ? 35
          : 0) + (qualification.instagram_status === "found" ? 25 : 0);
    const rawData = mergeQualificationIntoRawData(lead.rawData ?? lead.raw ?? {}, qualification);

    return {
      id: lead.id,
      qualification,
      rawData,
    };
  });

  return NextResponse.json({ results });
}
