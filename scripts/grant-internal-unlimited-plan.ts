import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

type PlanPayload = {
  billing_interval: "lifetime";
  currency: "BRL";
  features: string[];
  id: "vitalicio";
  is_active: true;
  lead_limit: null;
  name: string;
  pipeline_limit: null;
  price_cents: number;
  search_limit: null;
  sort_order: number;
  type: "vitalicio";
  whatsapp_instance_limit: null;
};

const unlimitedPlan: PlanPayload = {
  billing_interval: "lifetime",
  currency: "BRL",
  features: [
    "Tudo liberado para sempre",
    "Leads ilimitados",
    "Buscas ilimitadas",
    "Instâncias WhatsApp ilimitadas",
  ],
  id: "vitalicio",
  is_active: true,
  lead_limit: null,
  name: "Plano Vitalício",
  pipeline_limit: null,
  price_cents: 99798,
  search_limit: null,
  sort_order: 30,
  type: "vitalicio",
  whatsapp_instance_limit: null,
};

function parseInternalEmails() {
  const emails = (process.env.INTERNAL_UNLIMITED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const invalidPlaceholder = emails.some((email) => email.includes("coloque_aqui"));

  if (emails.length === 0 || invalidPlaceholder) {
    throw new Error(
      "Defina INTERNAL_UNLIMITED_EMAILS com emails reais separados por virgula antes de rodar este script.",
    );
  }

  return Array.from(new Set(emails));
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL antes de rodar este script.");
  }

  if (!serviceRoleKey) {
    throw new Error("Defina SUPABASE_SERVICE_ROLE_KEY antes de rodar este script.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findUserByEmail(supabase: SupabaseClient, email: string) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === email);

    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

function getFullName(user: User) {
  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name;

  return typeof fullName === "string" && fullName.trim() ? fullName.trim() : null;
}

async function ensureUnlimitedPlan(supabase: SupabaseClient) {
  const { error } = await supabase.from("plans").upsert(unlimitedPlan, { onConflict: "id" });

  if (error) {
    throw error;
  }

  console.log("Plano vitalicio garantido com limites ilimitados.");
}

async function grantUserUnlimitedPlan(supabase: SupabaseClient, email: string) {
  const user = await findUserByEmail(supabase, email);

  if (!user) {
    throw new Error(`Usuario nao encontrado no Supabase Auth: ${email}`);
  }

  const now = new Date().toISOString();
  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    throw profileLookupError;
  }

  const existingFullName =
    typeof existingProfile?.full_name === "string" && existingProfile.full_name.trim()
      ? existingProfile.full_name.trim()
      : null;

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      current_plan_id: unlimitedPlan.id,
      email: user.email ?? email,
      full_name: existingFullName ?? getFullName(user),
      id: user.id,
      updated_at: now,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw profileError;
  }

  const { data: existingSubscription, error: subscriptionLookupError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("plan_id", unlimitedPlan.id)
    .eq("external_provider", "manual")
    .maybeSingle();

  if (subscriptionLookupError) {
    throw subscriptionLookupError;
  }

  const subscriptionPayload = {
    canceled_at: null,
    current_period_end: null,
    current_period_start: now,
    external_id: `internal_unlimited_${user.id}`,
    external_provider: "manual",
    metadata: {
      email,
      reason: "internal_unlimited_email",
      source: "scripts/grant-internal-unlimited-plan.ts",
    },
    plan_id: unlimitedPlan.id,
    status: "active",
    updated_at: now,
    user_id: user.id,
  };

  const subscriptionResult = existingSubscription?.id
    ? await supabase
        .from("subscriptions")
        .update(subscriptionPayload)
        .eq("id", existingSubscription.id)
    : await supabase.from("subscriptions").insert(subscriptionPayload);

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  console.log(`Plano ilimitado aplicado para ${email}.`);
}

async function main() {
  const emails = parseInternalEmails();
  const supabase = createSupabaseAdminClient();

  await ensureUnlimitedPlan(supabase);

  for (const email of emails) {
    await grantUserUnlimitedPlan(supabase, email);
  }

  console.log(`Concluido. Contas internas processadas: ${emails.length}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
