export type InterEnvironment = "sandbox" | "production";

export type InterConfig = {
  apiBaseUrl: string;
  certificateBase64: string;
  certificatePassword?: string;
  clientId: string;
  clientSecret: string;
  environment: InterEnvironment;
  oauthUrl: string;
  pixKey: string;
  privateKeyBase64: string;
  webhookSecret?: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getInterEnvironment(): InterEnvironment {
  return readEnv("INTER_ENV") === "production" ? "production" : "sandbox";
}

export function getInterConfig(): InterConfig | null {
  const environment = getInterEnvironment();
  const apiBaseUrl = environment === "production"
    ? readEnv("INTER_API_BASE_URL_PRODUCTION")
    : readEnv("INTER_API_BASE_URL_SANDBOX");
  const oauthUrl = environment === "production"
    ? readEnv("INTER_OAUTH_URL_PRODUCTION")
    : readEnv("INTER_OAUTH_URL_SANDBOX");
  const config: InterConfig = {
    apiBaseUrl,
    certificateBase64: readEnv("INTER_CERTIFICATE_BASE64"),
    certificatePassword: readEnv("INTER_CERTIFICATE_PASSWORD") || undefined,
    clientId: readEnv("INTER_CLIENT_ID"),
    clientSecret: readEnv("INTER_CLIENT_SECRET"),
    environment,
    oauthUrl,
    pixKey: readEnv("INTER_PIX_KEY"),
    privateKeyBase64: readEnv("INTER_PRIVATE_KEY_BASE64"),
    webhookSecret: readEnv("INTER_WEBHOOK_SECRET") || undefined,
  };
  const required = [
    config.apiBaseUrl,
    config.certificateBase64,
    config.clientId,
    config.clientSecret,
    config.oauthUrl,
    config.pixKey,
    config.privateKeyBase64,
  ];

  return required.every(Boolean) ? config : null;
}

export function hasInterConfig() {
  return getInterConfig() !== null;
}

export function getInterMissingConfigKeys() {
  const environment = getInterEnvironment();
  const keys = [
    "INTER_CLIENT_ID",
    "INTER_CLIENT_SECRET",
    "INTER_CERTIFICATE_BASE64",
    "INTER_PRIVATE_KEY_BASE64",
    "INTER_PIX_KEY",
    environment === "production" ? "INTER_API_BASE_URL_PRODUCTION" : "INTER_API_BASE_URL_SANDBOX",
    environment === "production" ? "INTER_OAUTH_URL_PRODUCTION" : "INTER_OAUTH_URL_SANDBOX",
  ];

  return keys.filter((key) => !readEnv(key));
}

export function createInterIntegrationBlockedError() {
  return new Error(
    "Banco Inter está configurável, mas a chamada real está bloqueada até adicionarmos a documentação oficial de endpoints, payloads, webhooks e autenticação mTLS.",
  );
}
