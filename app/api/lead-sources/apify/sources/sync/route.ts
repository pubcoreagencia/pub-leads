import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { hasApifyConfig } from "@/src/lib/apify/client";
import { discoverApifySources } from "@/src/lib/apify/source-registry";
import { canSelectLeadSource } from "@/src/lib/permissions/source-permissions";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  if (!(await canSelectLeadSource(user))) {
    return NextResponse.json({ error: "Fontes Apify avancadas estao disponiveis apenas para contas internas." }, { status: 403 });
  }

  if (!hasApifyConfig()) {
    return NextResponse.json({ error: "Apify nao esta configurado." }, { status: 503 });
  }

  const sources = await discoverApifySources(user.id);

  return NextResponse.json({ sources });
}
