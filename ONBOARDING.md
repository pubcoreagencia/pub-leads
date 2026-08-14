# 🚀 ONBOARDING — PUBLEADS (Guia para Novo Desenvolvedor)

> **Leia este arquivo antes de qualquer coisa.** Ele é o seu mapa completo para acessar, configurar e contribuir com o PubLeads remotamente. Para detalhes de arquitetura e regras de código, leia o [`MASTER_CONTEXT.md`](./MASTER_CONTEXT.md).

---

## 🌐 1. Domínio & Produto

| Item | Valor |
|---|---|
| **URL Pública** | https://publeads.vercel.app |
| **Produto** | SaaS de Prospecção B2B com WhatsApp Nativo |
| **Stack** | Next.js 14 (App Router) · TypeScript · Tailwind · Supabase · Turso · Evolution API |

---

## 🔑 2. Acessos & Plataformas

### 🐙 GitHub — Código Fonte
- **Organização:** `pubcoreagencia`
- **Repositório:** https://github.com/pubcoreagencia/pub-leads
- **Branch principal:** `main` (produção automática via Vercel)
- **Acesso:** Peça ao responsável para adicionar seu usuário GitHub como colaborador em **Settings > Collaborators & teams**.

### ▲ Vercel — Hospedagem & Deploy
- **URL do painel:** https://vercel.com/pubcoreagencia/pub-leads
- **Deploy:** Automático a cada `git push origin main`
- **Acesso:** Peça ao responsável para te adicionar em **Settings > Members** da equipe Vercel.
- **Variáveis de Ambiente:** Configuradas em **Project Settings > Environment Variables** (ver Seção 4 abaixo).

### 🗄️ Supabase — Auth, Planos & Billing
- **URL do Painel:** https://supabase.com/dashboard/project/memcvxxdhnuyovtqvbyb
- **Project Ref:** `memcvxxdhnuyovtqvbyb`
- **URL Pública:** `https://memcvxxdhnuyovtqvbyb.supabase.co`
- **Responsabilidade:** Auth de usuários, planos (`plans`), perfis (`profiles`), assinaturas (`subscriptions`)
- **Acesso:** Peça ao responsável para te convidar em **Project Settings > Team**.
- **Pool de Conexão (para Evolution API):**
  ```
  postgresql://postgres.memcvxxdhnuyovtqvbyb:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
  ```

### ⚡ Turso — Banco de Dados de Leads (LibSQL/SQLite Serverless)
- **Painel:** https://turso.tech/app
- **Responsabilidade:** Leads, funis, sessões de scraping, instâncias de WhatsApp
- **⚠️ CRÍTICO:** Todas as queries **obrigatoriamente** filtram por `user_id` (sem RLS nativo)
- **Acesso:** Peça ao responsável as credenciais `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`

### 📲 Evolution API — WhatsApp Nativo
- **Documentação:** https://doc.evolution-api.com
- **Status de Deploy:** A ser configurado no Render ou VPS
- **Docker Compose:** [`docker-compose.evolution.yml`](./docker-compose.evolution.yml) pronto na raiz do projeto
- **Guia de Setup:** [`GUIA_EVOLUTION_API.md`](./GUIA_EVOLUTION_API.md)

---

## 🖥️ 3. Setup do Ambiente Local

```bash
# 1. Clone o repositório
git clone https://github.com/pubcoreagencia/pub-leads.git
cd pub-leads

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# (Edite o .env.local com os valores reais — ver Seção 4)

# 4. Execute as migrações no Turso
npm run turso:setup

# 5. Rode o servidor de desenvolvimento
npm run dev
# Acesse: http://localhost:3000
```

---

## 📋 4. Variáveis de Ambiente (.env.local)

Copie o `.env.example` e preencha com os valores reais:

```env
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUPABASE (Auth, Plans & Billing)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_SUPABASE_URL=https://memcvxxdhnuyovtqvbyb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=            # Supabase > Project Settings > API > anon key
SUPABASE_SERVICE_ROLE_KEY=                # Supabase > Project Settings > API > service_role key

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TURSO (Banco de Leads)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TURSO_DATABASE_URL=                       # libsql://seu-banco.turso.io
TURSO_AUTH_TOKEN=                         # Token do Turso
LEADS_DB_PROVIDER=turso

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# APIFY (Motor de Prospecção Google Maps)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APIFY_TOKEN=                              # apify.com > Settings > API tokens
APIFY_GOOGLE_MAPS_ACTOR_ID=compass/crawler-google-places
APIFY_MONTHLY_BUDGET_USD=5
APIFY_GOOGLE_MAPS_MAX_RESULTS_PER_RUN=50

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# OPENAI (Variação de mensagens com IA)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPENAI_API_KEY=                           # platform.openai.com
OPENAI_MODEL=gpt-4.1-mini

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# APP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_APP_URL=http://localhost:3000
BILLING_PROVIDER=mock
```

> **Onde encontrar cada valor:**
> - **Supabase Keys:** Painel Supabase > **Project Settings > API**
> - **Turso:** Painel Turso > **Databases > seu-banco > Connect**
> - **Apify Token:** https://console.apify.com/account/integrations
> - **OpenAI:** https://platform.openai.com/api-keys

---

## 🏗️ 5. Estrutura de Pastas (Resumo)

```
pub-leads/
├── app/                      # Next.js App Router
│   ├── (public)/             # Landing page pública
│   ├── api/                  # API Routes (rotas backend)
│   │   ├── lead-sources/     # Prospecção (Apify, Google, CNPJ, Enriquecimento)
│   │   ├── whatsapp/         # Evolution API (instâncias, status, disparo)
│   │   └── billing/          # Assinaturas e planos
│   └── app/                  # Área logada
│       ├── dashboard/        # Painel principal e CRM
│       ├── scraper/          # Motor de prospecção
│       ├── whatsapp/         # Guia de Abordagem
│       └── conexoes/         # Gerenciamento de chips WhatsApp
├── components/               # Componentes React reutilizáveis
│   ├── vfx/                  # VFX Canvas (rastro de envelopes)
│   ├── layout/               # Layouts públicos e privados
│   └── conexoes/             # Interface de conexões WhatsApp
├── src/lib/                  # Lógica central / Services
│   ├── turso/                # Repositórios do Turso (leads, sessions, whatsapp)
│   ├── lead-sources/         # Pipeline de enriquecimento e normalização
│   ├── whatsapp/             # Evolution API client
│   └── supabase/             # Clientes Supabase (server/client)
├── public/brand/             # Assets da marca (logo, ícones)
├── MASTER_CONTEXT.md         # Arquitetura completa + regras para devs
├── ONBOARDING.md             # Este arquivo — Setup do novo desenvolvedor
├── GUIA_EVOLUTION_API.md     # Como subir e conectar a Evolution API
└── docker-compose.evolution.yml  # Docker para rodar Evolution API localmente
```

---

## 🔄 6. Fluxo de Trabalho com Git

```bash
# Sempre trabalhe em branch separada
git checkout -b feature/nome-da-feature

# Commit com mensagens descritivas
git commit -m "feat(whatsapp): implementa delay inteligente entre disparos em lote"

# Push e abra Pull Request para main
git push origin feature/nome-da-feature
```

### Padrão de commits:
| Prefixo | Quando usar |
|---|---|
| `feat(...)` | Nova funcionalidade |
| `fix(...)` | Correção de bug |
| `style(...)` | Mudança visual sem lógica |
| `refactor(...)` | Refatoração de código |
| `docs(...)` | Atualização de documentação |
| `perf(...)` | Otimização de performance |

---

## 🧩 7. Features Implementadas (Status Atual)

| Feature | Status | Onde está |
|---|---|---|
| Prospecção via Apify Google Maps | ✅ Produção | `/app/scraper` |
| Enriquecimento Web (WA, IG, Email) | ✅ Produção | `src/lib/lead-sources/enrichment-pipeline.ts` |
| CRM / Pipeline de Funis | ✅ Produção | `/app/dashboard` |
| Guia de Abordagem Simplificado | ✅ Produção | `/app/whatsapp` |
| Conexões WhatsApp (Evolution API) | ✅ Implementado | `/app/conexoes` |
| Disparo Nativo WhatsApp | ✅ Implementado | `app/api/whatsapp/send-native` |
| VFX Canvas (rastro de envelopes) | ✅ Produção | `components/vfx/` |
| Landing Page com Dark Header | ✅ Produção | `app/(public)/page.tsx` |
| Disparo em Lote com Delay | 🔲 Backlog | — |
| Webhooks de Resposta do WhatsApp | 🔲 Backlog | — |
| Validação Ativa de Número WA | 🔲 Backlog | — |

---

## ⚠️ 8. Regras Críticas que Todo Dev Deve Seguir

1. **Turso = filtro `user_id` sempre** — sem exceção, sem RLS automático.
2. **Supabase = autenticação e billing apenas** — nunca salvar leads ou sessões lá.
3. **Variáveis de env** — nunca commitar `.env.local` ou segredos no Git.
4. **Build na Vercel** — o build falha localmente se não houver `.env.local` com as keys do Supabase. Na Vercel funciona normalmente.
5. **Evolution API** — o cliente está em `src/lib/whatsapp/evolution-client.ts`. A URL e API Key são por instância (salvas no Turso por usuário).

---

## 📞 9. Contato

- **Responsável pelo produto:** Matheus Paes (leurilarry@gmail.com)
- **Repositório:** https://github.com/pubcoreagencia/pub-leads
- **Site oficial:** https://publeads.vercel.app
