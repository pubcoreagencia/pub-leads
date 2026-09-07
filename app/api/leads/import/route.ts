import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const leadSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(255),
  email: z.string().email('Email invalid').or(z.literal('')).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Telefone deve estar em formato E.164').or(z.literal('')).optional(),
  company: z.string().max(255).optional(),
  job_title: z.string().max(255).optional(),
  linkedin_url: z.string().url('LinkedIn URL invalid').optional().or(z.literal('')),
  source: z.enum(['manual', 'csv_import', 'scraping', 'referral', 'event', 'webhook']),
  notes: z.string().max(2000).optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  score: z.number().int().min(0).max(100).optional(),
});

const importSchema = z.object({
  leads: z.array(leadSchema).min(1).max(1000),
  deduplicate_by: z.enum(['email', 'phone', 'linkedin_url', 'none']).default('email'),
  skip_invalid: z.boolean().default(false),
  assign_tags: z.array(z.string()).optional(),
  default_status: z.enum(['new', 'qualified', 'contacted', 'unqualified']).default('new'),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { leads, deduplicate_by, assign_tags, default_status } = parsed.data;
    const skipInvalid = parsed.data.skip_invalid;

    const validLeads: z.infer<typeof leadSchema>[] = [];
    const invalidLeads: { index: number; errors: string[]; data: unknown }[] = [];

    leads.forEach((lead, index) => {
      const validation = leadSchema.safeParse(lead);
      if (validation.success) {
        validLeads.push(validation.data);
      } else {
        invalidLeads.push({
          index,
          errors: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
          data: lead,
        });
      }
    });

    if (skipInvalid && invalidLeads.length > 0) {
      // continue
    } else if (invalidLeads.length > 0) {
      return NextResponse.json(
        { error: 'Some leads are invalid', invalid_count: invalidLeads.length, invalid_leads: invalidLeads.slice(0, 10) },
        { status: 422 }
      );
    }

    let duplicatesFound = 0;
    let inserted = 0;
    const errors: string[] = [];

    if (deduplicate_by !== 'none') {
      const dedupeValues = validLeads
        .map(l => {
          if (deduplicate_by === 'email') return l.email;
          if (deduplicate_by === 'phone') return l.phone;
          if (deduplicate_by === 'linkedin_url') return l.linkedin_url;
          return null;
        })
        .filter((v): v is string => Boolean(v && v.length > 0));

      if (dedupeValues.length > 0) {
        const column = deduplicate_by === 'linkedin_url' ? 'linkedin_url' : deduplicate_by;
        const { data: existing } = await supabase
          .from('leads')
          .select(column)
          .eq('user_id', user.id)
          .in(column, dedupeValues);

        const existingSet = new Set((existing || []).map((r: any) => r[column]).filter(Boolean));
        const filtered = validLeads.filter(l => {
          const val = deduplicate_by === 'email' ? l.email : deduplicate_by === 'phone' ? l.phone : l.linkedin_url;
          if (val && existingSet.has(val)) {
            duplicatesFound++;
            return false;
          }
          return true;
        });
        validLeads.length = 0;
        validLeads.push(...filtered);
      }
    }

    const records = validLeads.map(lead => ({
      user_id: user.id,
      name: lead.name,
      email: lead.email || null,
      phone: lead.phone || null,
      company: lead.company || null,
      job_title: lead.job_title || null,
      linkedin_url: lead.linkedin_url || null,
      source: lead.source,
      notes: lead.notes || null,
      custom_fields: lead.custom_fields || null,
      tags: [...(lead.tags || []), ...(assign_tags || [])],
      score: lead.score ?? null,
      status: default_status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('leads')
        .insert(batch)
        .select('id');

      if (error) {
        errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
      } else {
        inserted += data?.length || batch.length;
      }
    }

    await supabase.from('lead_import_logs').insert({
      user_id: user.id,
      total_submitted: leads.length,
      valid_count: validLeads.length,
      invalid_count: invalidLeads.length,
      duplicates_found: duplicatesFound,
      inserted_count: inserted,
      deduplicate_by,
      error_count: errors.length,
      errors: errors.length > 0 ? errors : null,
      created_at: new Date().toISOString(),
    }).select().maybeSingle();

    return NextResponse.json({
      success: true,
      summary: {
        submitted: leads.length,
        valid: leads.length - invalidLeads.length,
        invalid: invalidLeads.length,
        duplicates_found: duplicatesFound,
        inserted,
        errors: errors.length,
      },
      invalid_leads: invalidLeads.slice(0, 50),
      error_details: errors.slice(0, 10),
    }, { status: 201 });

  } catch (err) {
    console.error('Lead import error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data, error, count } = await supabase
      .from('lead_import_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ logs: data, total: count, limit, offset });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
