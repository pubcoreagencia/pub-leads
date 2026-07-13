import type { TrackingProvider } from "@/src/lib/tracking/types";

export const noopTrackingProvider: TrackingProvider = {
  configured: true,
  id: "none",
  async track() {
    return {
      provider: "none",
      sent: false,
      skippedReason: "disabled",
    };
  },
};
