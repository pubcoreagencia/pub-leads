import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getBillingProvider } from "@/src/lib/billing/provider";

const checkoutSchema = z.object({
  planId: z.enum(["mensal", "anual", "vitalicio"]),
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
  const session = await provider.createCheckoutSession({
    email: user.email,
    planId: parsed.data.planId,
    userId: user.id,
  });

  return NextResponse.json(session);
}
