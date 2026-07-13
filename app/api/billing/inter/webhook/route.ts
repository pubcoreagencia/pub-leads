import { NextResponse } from "next/server";

import { parseInterWebhook } from "@/src/lib/billing/inter/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await parseInterWebhook(await request.json(), request.headers);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook Inter não processado.",
      },
      { status: 501 },
    );
  }

  return NextResponse.json({ received: true });
}
