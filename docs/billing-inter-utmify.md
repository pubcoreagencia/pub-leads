# Billing: Banco Inter + Utmify

## Decisão

- Banco Inter é a fonte de verdade do pagamento.
- Utmify é somente tracking, dashboard e atribuição.
- Utmify nunca ativa plano e nunca substitui confirmação bancária.
- Supabase continua responsável por `profiles`, `plans`, `subscriptions` e `payments`.
- Turso não participa de cobrança.

## Providers

```env
BILLING_PROVIDER=mock
TRACKING_PROVIDER=none
```

Valores aceitos:

- `BILLING_PROVIDER=mock`: mantém checkout de desenvolvimento.
- `BILLING_PROVIDER=inter`: seleciona o provider Banco Inter.
- `TRACKING_PROVIDER=none`: não envia eventos externos.
- `TRACKING_PROVIDER=utmify`: prepara envio de eventos para Utmify.

## Estado atual da integração

A arquitetura de providers, envs, captura de UTMs, mappers e status seguro está preparada.

As chamadas reais para Banco Inter e Utmify permanecem bloqueadas até termos a documentação oficial completa:

- endpoints oficiais;
- payloads de criação/consulta de cobrança;
- regra de autenticação mTLS/OAuth;
- validação de webhook;
- payload oficial da Utmify;
- eventos aceitos pela Utmify;
- regra de idempotência/retry.

Não inventar endpoints ou payloads.

## Banco Inter

Variáveis esperadas:

```env
BILLING_PROVIDER=inter
INTER_ENV=sandbox
INTER_CLIENT_ID=
INTER_CLIENT_SECRET=
INTER_CERTIFICATE_BASE64=
INTER_PRIVATE_KEY_BASE64=
INTER_CERTIFICATE_PASSWORD=
INTER_PIX_KEY=
INTER_WEBHOOK_SECRET=
INTER_API_BASE_URL_SANDBOX=
INTER_API_BASE_URL_PRODUCTION=
INTER_OAUTH_URL_SANDBOX=
INTER_OAUTH_URL_PRODUCTION=
```

Campos opcionais, se exigidos pela documentação:

```env
INTER_ACCOUNT_BRANCH=
INTER_ACCOUNT_NUMBER=
INTER_COMPANY_CNPJ=
INTER_CONTA_CORRENTE=
INTER_CONVENIO=
INTER_COBRANCA_CARTEIRA=
```

Rotas Banco Inter devem rodar em `runtime = "nodejs"`.

## Utmify

Variáveis esperadas:

```env
TRACKING_PROVIDER=utmify
UTMIFY_API_BASE_URL=
UTMIFY_API_TOKEN=
UTMIFY_WEBHOOK_SECRET=
UTMIFY_PIXEL_ID=
UTMIFY_STORE_ID=
UTMIFY_DEFAULT_CURRENCY=BRL
```

Não usar `NEXT_PUBLIC_` para tokens.

Falhas de tracking não podem impedir ativação de plano quando o Banco Inter confirmar pagamento.

## UTMs

O frontend captura:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `src`
- `sck`
- `fbclid`
- `gclid`
- `ttclid`
- `campaign_id`
- `adset_id`
- `ad_id`
- `creative_id`

Esses dados são preservados em `localStorage` e cookie first-party para envio ao backend no início do checkout.

## Migração Supabase

Para preparar campos extras de pagamentos reais, rode manualmente:

```sql
-- supabase/add-billing-provider-fields.sql
```

Não rode cleanup e não mova dados operacionais para Supabase.
