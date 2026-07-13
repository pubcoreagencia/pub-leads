"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { attributionParamKeys } from "@/src/lib/tracking/types";
import { attributionStorageKey, hasAttributionParams, sanitizeAttributionParams } from "@/src/lib/tracking/utms";

export function UtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = attributionParamKeys.reduce<Record<string, string>>((params, key) => {
      const value = searchParams.get(key);

      if (value) {
        params[key] = value;
      }

      return params;
    }, {});
    const attribution = sanitizeAttributionParams(raw);

    if (!hasAttributionParams(attribution)) {
      return;
    }

    const serialized = JSON.stringify({
      capturedAt: new Date().toISOString(),
      params: attribution,
    });

    window.localStorage.setItem(attributionStorageKey, serialized);
    document.cookie = `${attributionStorageKey}=${encodeURIComponent(serialized)}; Max-Age=2592000; Path=/; SameSite=Lax`;
  }, [searchParams]);

  return null;
}
