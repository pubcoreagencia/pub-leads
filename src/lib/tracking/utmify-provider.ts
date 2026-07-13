import type { TrackingProvider } from "@/src/lib/tracking/types";
import {
  createUtmifyContractMissingError,
  getUtmifyMissingConfigKeys,
  hasUtmifyConfig,
} from "@/src/lib/tracking/utmify/client";

export const utmifyTrackingProvider: TrackingProvider = {
  configured: hasUtmifyConfig(),
  id: "utmify",
  async track() {
    const missing = getUtmifyMissingConfigKeys();

    if (missing.length > 0) {
      return {
        error: `Utmify não configurada. Variáveis ausentes: ${missing.join(", ")}.`,
        provider: "utmify",
        sent: false,
        skippedReason: "missing_config",
      };
    }

    const error = createUtmifyContractMissingError();

    return {
      error: error.message,
      provider: "utmify",
      sent: false,
      skippedReason: "missing_official_contract",
    };
  },
};
