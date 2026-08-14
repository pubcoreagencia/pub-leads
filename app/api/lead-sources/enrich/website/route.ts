import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichSessionResultsFromWebsite } from "@/src/lib/lead-sources/enrichment-pipeline";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  }

  let body: { sessionId?: string; resultIds?: string[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { sessionId, resultIds } = body;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId é obrigatório." }, { status: 400 });
  }

  if (!Array.isArray(resultIds) || resultIds.length === 0) {
    return NextResponse.json({ error: "resultIds deve ser um array não vazio." }, { status: 400 });
  }

  const validIds = resultIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);

  if (validIds.length === 0) {
    return NextResponse.json({ error: "Nenhum resultId válido fornecido." }, { status: 400 });
  }

  const summary = await enrichSessionResultsFromWebsite(user.id, sessionId, validIds);

  return NextResponse.json(summary);
}
