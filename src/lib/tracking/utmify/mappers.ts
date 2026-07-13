import type { TrackingEvent } from "@/src/lib/tracking/types";

export function mapTrackingEventToUtmifyDraft(event: TrackingEvent) {
  return {
    amount: event.amountCents,
    currency: event.currency ?? "BRL",
    customer: event.customer,
    event_id: event.eventId,
    event_name: event.eventName,
    metadata: event.metadata,
    order_id: event.orderId ?? event.eventId,
    product: event.product,
    provider_payment_id: event.providerPaymentId,
    status: event.status,
    utms: event.utms,
  };
}
