export type TrackingProviderId = "none" | "utmify";

export const attributionParamKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "src",
  "sck",
  "fbclid",
  "gclid",
  "ttclid",
  "campaign_id",
  "adset_id",
  "ad_id",
  "creative_id",
] as const;

export type AttributionParamKey = (typeof attributionParamKeys)[number];
export type AttributionParams = Partial<Record<AttributionParamKey, string>>;

export type TrackingEventName =
  | "checkout_started"
  | "checkout_created"
  | "payment_pending"
  | "purchase_approved"
  | "payment_failed"
  | "payment_expired"
  | "refund";

export type TrackingEvent = {
  amountCents?: number;
  currency?: "BRL";
  customer?: {
    email?: string | null;
    id: string;
    name?: string | null;
  };
  eventId: string;
  eventName: TrackingEventName;
  metadata?: Record<string, unknown>;
  orderId?: string;
  paidAt?: string | null;
  product?: {
    id: string;
    name: string;
    type: "subscription" | "lifetime";
  };
  providerPaymentId?: string | null;
  status?: string;
  utms?: AttributionParams;
};

export type TrackingResult = {
  error?: string;
  provider: TrackingProviderId;
  sent: boolean;
  skippedReason?: "disabled" | "missing_config" | "missing_official_contract";
};

export type TrackingProvider = {
  configured: boolean;
  id: TrackingProviderId;
  track(event: TrackingEvent): Promise<TrackingResult>;
};

export type TrackingRuntimeStatus = {
  trackingConfigured: boolean;
  trackingProvider: TrackingProviderId;
};
