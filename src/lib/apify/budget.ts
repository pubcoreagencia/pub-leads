export function getApifyMonthlyBudget() { return Math.max(0, Number(process.env.APIFY_MONTHLY_BUDGET_USD ?? "5") || 5); }
export function estimateApifyGoogleMapsCost(requestedLimit: number) { return Math.max(0.05, requestedLimit * 0.01); }
export function getApifyGoogleMapsLimit() { return Math.min(Math.max(Number(process.env.APIFY_GOOGLE_MAPS_MAX_RESULTS_PER_RUN ?? "50") || 50, 1), 50); }
export function getApifyMaxResultsPerRun() { return Math.min(Math.max(Number(process.env.APIFY_MAX_RESULTS_PER_RUN ?? "50") || 50, 1), 100); }
export function estimateApifyRunCost(category: string, requestedLimit: number) {
  if (category === "google_maps") return estimateApifyGoogleMapsCost(requestedLimit);
  if (category === "instagram") return Math.max(0.03, requestedLimit * 0.008);
  if (category === "google_search") return Math.max(0.02, requestedLimit * 0.005);
  return Math.max(0.02, requestedLimit * 0.005);
}
