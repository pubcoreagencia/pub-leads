import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBillingProvider } from "@/src/lib/billing/provider";
import type { BillablePlanId } from "@/src/lib/billing/types";

const amountByPlan: Record<BillablePlanId, number> = {
  mensal: 14799,
  anual: 49799,
  vitalicio: 99798,
};

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const provider = getBillingProvider();
  let event: Awaited<ReturnType<typeof provider.parseWebhook>>;
  let supabase: ReturnType<typeof createAdminClient>;

  try {
    event = await provider.parseWebhook(await request.json());
  } catch {
    return NextResponse.json({ error: "Webhook invalido." }, { status: 400 });
  }

  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook admin client not configured.",
      },
      { status: 500 },
    );
  }

  if (event.type === "checkout.completed") {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ current_plan_id: event.planId })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .insert({
        external_id: event.externalId ?? `mock_${user.id}_${event.planId}_${Date.now()}`,
        external_provider: "mock",
        metadata: { eventType: event.type },
        plan_id: event.planId,
        status: "active",
        user_id: user.id,
      })
      .select("id")
      .single();

    if (subscriptionError) {
      return NextResponse.json({ error: subscriptionError.message }, { status: 400 });
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      amount_cents: event.amountCents ?? amountByPlan[event.planId],
      currency: "BRL",
      metadata: { eventType: event.type },
      paid_at: new Date().toISOString(),
      plan_id: event.planId,
      provider: "mock",
      provider_payment_id: event.externalId,
      status: "paid",
      subscription_id: subscription.id,
      user_id: user.id,
    });

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }
  }

  if (event.type === "subscription.canceled") {
    await supabase
      .from("profiles")
      .update({ current_plan_id: "free" })
      .eq("id", user.id);
  }

  return NextResponse.json({ received: true });
}
