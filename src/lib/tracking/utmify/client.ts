function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function hasUtmifyConfig() {
  return Boolean(readEnv("UTMIFY_API_BASE_URL") && readEnv("UTMIFY_API_TOKEN"));
}

export function getUtmifyMissingConfigKeys() {
  return ["UTMIFY_API_BASE_URL", "UTMIFY_API_TOKEN"].filter((key) => !readEnv(key));
}

export function createUtmifyContractMissingError() {
  return new Error(
    "Utmify tracking está configurável, mas chamadas reais estão bloqueadas até adicionarmos endpoint oficial, payload, autenticação, eventos aceitos e regra de idempotência.",
  );
}
