import { attributionParamKeys, type AttributionParams } from "@/src/lib/tracking/types";

export const attributionStorageKey = "publeads_attribution";

export function sanitizeAttributionParams(input: unknown): AttributionParams {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, unknown>;

  return attributionParamKeys.reduce<AttributionParams>((params, key) => {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      params[key] = value.trim().slice(0, 300);
    }

    return params;
  }, {});
}

export function hasAttributionParams(params: AttributionParams) {
  return Object.values(params).some(Boolean);
}
