import type { TrackingEvent } from "@/src/lib/tracking/types";
import { createUtmifyContractMissingError } from "@/src/lib/tracking/utmify/client";
import { mapTrackingEventToUtmifyDraft } from "@/src/lib/tracking/utmify/mappers";

export async function sendUtmifyEvent(event: TrackingEvent) {
  const draftPayload = mapTrackingEventToUtmifyDraft(event);

  void draftPayload;

  throw createUtmifyContractMissingError();
}
