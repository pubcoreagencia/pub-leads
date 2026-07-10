import { ScraperPageContent } from "@/components/scraper/scraper-page-content";
import { createClient } from "@/lib/supabase/server";
import { hasGooglePlacesConfig } from "@/src/lib/lead-sources/google-places";
import { canSelectLeadSource } from "@/src/lib/permissions/source-permissions";

export default async function ScraperPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const canSelectSource = user ? await canSelectLeadSource(user) : false;

  return (
    <ScraperPageContent
      canSelectSource={canSelectSource}
      googlePlacesEnabled={hasGooglePlacesConfig()}
    />
  );
}
