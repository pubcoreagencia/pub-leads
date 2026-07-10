export function getApifyMonthlyBudget() { return Math.max(0, Number(process.env.APIFY_MONTHLY_BUDGET_USD ?? "5") || 5); }
export function estimateApifyGoogleMapsCost(requestedLimit: number) { return Math.max(0.05, requestedLimit * 0.01); }
export function getApifyGoogleMapsLimit() { return Math.min(Math.max(Number(process.env.APIFY_GOOGLE_MAPS_MAX_RESULTS_PER_RUN ?? "50") || 50, 1), 50); }
