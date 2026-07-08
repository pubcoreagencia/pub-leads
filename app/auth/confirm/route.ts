import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app/dashboard";
  const redirectTo = request.nextUrl.clone();

  redirectTo.pathname = "/login";
  redirectTo.search = "";

  if (!hasSupabaseConfig() || !tokenHash || !type) {
    redirectTo.searchParams.set("error", "auth-confirmation-failed");
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    redirectTo.searchParams.set("error", "auth-confirmation-failed");
    return NextResponse.redirect(redirectTo);
  }

  redirectTo.pathname = next;
  return NextResponse.redirect(redirectTo);
}
