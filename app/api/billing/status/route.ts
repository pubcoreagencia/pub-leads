import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getBillingRuntimeStatus } from "@/src/lib/billing/provider";
import { getTrackingRuntimeStatus } from "@/src/lib/tracking/provider";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  }

  return NextResponse.json({
    ...getBillingRuntimeStatus(),
    ...getTrackingRuntimeStatus(),
  });
}
