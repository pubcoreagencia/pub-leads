import { createClient, type Client } from "@libsql/client";

let cachedClient: Client | null = null;

function isLocalLibsqlUrl(url: string) {
  return url.startsWith("file:") || url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost");
}

export function getTursoUnavailableMessage() {
  return "Turso nao configurado. Defina TURSO_DATABASE_URL, TURSO_AUTH_TOKEN (se o banco for remoto) e LEADS_DB_PROVIDER=turso.";
}

export function hasTursoConfig() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  return Boolean(url && (token || isLocalLibsqlUrl(url)));
}

export function getTursoClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(getTursoUnavailableMessage());
  }

  if (!authToken && !isLocalLibsqlUrl(url)) {
    throw new Error(getTursoUnavailableMessage());
  }

  cachedClient ??= createClient({
    authToken,
    url,
  });

  return cachedClient;
}
