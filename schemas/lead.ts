import { z } from "zod";

export const leadStatusSchema = z.enum([
  "new",
  "qualified",
  "contacted",
  "responded",
  "proposal",
  "won",
  "lost",
]);

export const leadSourceSchema = z.enum([
  "openstreetmap",
  "overpass",
  "csv",
  "manual",
  "google_places",
  "cnpj_brasil",
  "apify_instagram",
  "apify_google_search",
  "apify_generic",
]);

export const leadFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do lead."),
  company: z.string().trim().optional(),
  category: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Informe um email valido.",
    }),
  instagram: z.string().trim().optional(),
  website: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  status: leadStatusSchema,
  source: leadSourceSchema,
});

export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type LeadSource = z.infer<typeof leadSourceSchema>;
export type LeadFormValues = z.infer<typeof leadFormSchema>;

export type Lead = {
  id: string;
  user_id: string;
  source: LeadSource;
  external_id: string | null;
  name: string;
  company: string | null;
  business_name: string | null;
  fantasy_name: string | null;
  cnpj: string | null;
  category: string | null;
  cnae: string | null;
  cnae_description: string | null;
  phone: string | null;
  phone_2: string | null;
  whatsapp: string | null;
  phone_type: "mobile" | "landline" | "invalid" | "unknown" | "missing";
  normalized_phone: string | null;
  normalized_whatsapp: string | null;
  whatsapp_status: "confirmed" | "possible" | "landline" | "missing" | "invalid" | "unknown";
  whatsapp_confidence: number | null;
  whatsapp_validation_source: string | null;
  whatsapp_checked_at: string | null;
  qualification_tags: string[];
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  status: LeadStatus;
  pipeline_stage: LeadStatus;
  metadata: Record<string, unknown>;
  enrichment_source: string | null;
  enrichment_confidence: number | null;
  raw_cnpj_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type LeadNote = {
  id: string;
  user_id: string;
  lead_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type LeadFilters = {
  name?: string;
  city?: string;
  category?: string;
  status?: LeadStatus | "all";
  source?: LeadSource | "all";
  onlyWithPhone?: boolean;
  savedDate?: string;
  qualification?: "all" | "with_whatsapp" | "without_whatsapp" | "with_instagram" | "without_instagram";
  site?: "all" | "with_site" | "without_site";
};
