/**
 * Retorna as credenciais globais da Evolution API a partir das variáveis de ambiente.
 * Lança um erro descritivo se as variáveis não estiverem configuradas.
 *
 * Configure na Vercel:
 *   EVOLUTION_API_URL  — URL do servidor (ex: https://evolution-api-xxxx.onrender.com)
 *   EVOLUTION_API_KEY  — Global API Key da Evolution API
 */
export function getEvolutionConfig(): { serverUrl: string; apiKey: string } {
  const serverUrl = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();

  if (!serverUrl || !apiKey) {
    throw new Error(
      "Evolution API não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY nas variáveis de ambiente (Vercel > Project Settings > Environment Variables).",
    );
  }

  return { serverUrl, apiKey };
}

export function hasEvolutionConfig(): boolean {
  return Boolean(
    process.env.EVOLUTION_API_URL?.trim() &&
    process.env.EVOLUTION_API_KEY?.trim(),
  );
}
