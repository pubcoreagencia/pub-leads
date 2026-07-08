import { ScraperPageContent } from "@/components/scraper/scraper-page-content";
import { hasGooglePlacesConfig } from "@/src/lib/lead-sources/google-places";

export default function ScraperPage() {
  return <ScraperPageContent googlePlacesEnabled={hasGooglePlacesConfig()} />;
}
