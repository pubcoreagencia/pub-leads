import { createInterIntegrationBlockedError } from "@/src/lib/billing/inter/client";

export async function parseInterWebhook(_payload: unknown, _headers: Headers) {
  void _payload;
  void _headers;
  throw createInterIntegrationBlockedError();
}
