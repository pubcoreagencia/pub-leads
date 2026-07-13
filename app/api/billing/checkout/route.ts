import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getBillablePlan } from "@/src/lib/billing/plans";
import { getBillingProvider } from "@/src/lib/billing/provider";
import { getTrackingProvider } from "@/src/lib/tracking/provider";
import { sanitizeAttributionParams } from "@/src/lib/tracking/utms";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  planId: z.enum(["mensal", "anual", "vitalicio"]),
  utms: z.record(z.string()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const parsed = checkoutSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Plano invalido." }, { status: 400 });
  }

  const provider = getBillingProvider();
  const plan = getBillablePlan(parsed.data.planId);
  const utms = sanitizeAttributionParams(parsed.data.utms);
  let session: Awaited<ReturnType<typeof provider.createCheckoutSession>>;

  try {
    session = await provider.createCheckoutSession({
      amountCents: plan.priceCents,
      currency: plan.currency,
      email: user.email,
      metadata: {
        billing_provider: provider.id,
      },
      planId: parsed.data.planId,
      utms,
      userId: user.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível iniciar checkout.",
      },
      { status: 503 },
    );
  }
  const tracking = getTrackingProvider();
  const trackingResult = await tracking.track({
    amountCents: plan.priceCents,
    currency: plan.currency,
    customer: {
      email: user.email,
      id: user.id,
    },
    eventId: `checkout_created:${user.id}:${plan.id}:${Date.now()}`,
    eventName: "checkout_created",
    metadata: {
      billing_provider: provider.id,
      tracking_provider: tracking.id,
    },
    orderId: session.paymentId ?? `${user.id}:${plan.id}`,
    product: {
      id: plan.id,
      name: plan.name,
      type: plan.type,
    },
    status: session.status,
    utms,
  });

  return NextResponse.json({
    ...session,
    tracking: {
      provider: trackingResult.provider,
      sent: trackingResult.sent,
      skippedReason: trackingResult.skippedReason,
    },
  });
}
