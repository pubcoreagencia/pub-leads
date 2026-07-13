import { noopTrackingProvider } from "@/src/lib/tracking/noop-provider";
import { utmifyTrackingProvider } from "@/src/lib/tracking/utmify-provider";
import type { TrackingProviderId, TrackingRuntimeStatus } from "@/src/lib/tracking/types";
import { hasUtmifyConfig } from "@/src/lib/tracking/utmify/client";

export function getTrackingProviderId(): TrackingProviderId {
  return process.env.TRACKING_PROVIDER === "utmify" ? "utmify" : "none";
}

export function getTrackingProvider() {
  return getTrackingProviderId() === "utmify" ? utmifyTrackingProvider : noopTrackingProvider;
}

export function getTrackingRuntimeStatus(): TrackingRuntimeStatus {
  const trackingProvider = getTrackingProviderId();

  return {
    trackingConfigured: trackingProvider === "utmify" ? hasUtmifyConfig() : true,
    trackingProvider,
  };
}
