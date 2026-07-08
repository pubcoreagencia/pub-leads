# PubLeads

PubLeads e um SaaS B2B de prospeccao, CRM, pipeline, WhatsApp manual, mensagens com IA e billing.

## Arquitetura

- Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui e lucide-react.
- Supabase Auth continua responsavel por login, profiles, plans, subscriptions e payments.
- Turso/libSQL armazena dados volumosos de prospeccao: leads, notas, mensagens geradas e logs de busca.
- O browser nunca acessa `TURSO_AUTH_TOKEN`; as paginas chamam APIs Next.js autenticadas por Supabase.
- Como Turso nao tem RLS, todos os repositories filtram obrigatoriamente por `user_id`.

## Env Local

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
LEADS_DB_PROVIDER=turso
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Em Vercel, configure as mesmas variaveis em Production. Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` ou `TURSO_AUTH_TOKEN` no client.

## Setup

```bash
npm install
npm run turso:setup
npm run dev
```

Para manter Supabase leve, rode `supabase/lightweight-schema.sql` no SQL Editor. Esse é o schema recomendado para setups novos e nao cria tabelas de leads.

## Migracao de Leads

Depois de configurar Supabase e Turso:

```bash
npm run turso:migrate
npm run turso:verify
```

Somente apos a verificacao passar, avalie `scripts/cleanup-supabase-leads.sql`. O arquivo esta comentado de proposito e nao deve ser executado antes da validacao em producao.

## Validacao

```bash
npm run lint
npm run build
npx tsc --noEmit
```

Use fixtures ou mocks para testes. Evite chamadas reais a Supabase, Turso, Overpass, Google Places e OpenAI em testes automatizados.
