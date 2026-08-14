# MASTER CONTEXT & ARCHITECTURE GUIDE — PUBLEADS

> **Documento Central para o Time de Engenharia**
> Este arquivo serve como o Single Source of Truth (SSOT) para arquitetura, regras de negócio, convenções de código, melhorias recentes e roadmap para desenvolvimento paralelo entre múltiplos desenvolvedores.

---

## 📌 1. Visão Geral do Sistema

O **PubLeads** é uma plataforma SaaS de prospecção, qualificação, enriquecimento e gestão de leads (CRM/Pipeline) B2B focado no mercado brasileiro.

### 🏛️ Arquitetura de Dois Bancos de Dados
O sistema utiliza uma separação estrita de responsabilidades:

1. **Supabase (PostgreSQL + RLS):**
   - Autenticação de usuários (`auth.users`)
   - Gerenciamento de assinaturas, planos e billing (`subscriptions`, `stripe/asaas webhook`)
   - Contexto de sessão e middleware Next.js

2. **Turso (libSQL / SQLite Serverless):**
   - Armazenamento de dados volumosos e transacionais de prospecção.
   - **Isolamento multi-tenant manual**: Como não usa RLS nativo, **todas as queries sem exceção devem filtrar explicitamente por `user_id`**.
   - Tabelas principais: `leads`, `lead_notes`, `lead_messages`, `search_logs`, `apify_runs`, `apify_sources`, `scraping_sessions`, `scraping_session_results`, `cnpj_establishments`, `message_funnels`, `message_funnel_steps`, `lead_funnel_states`, `lead_message_events`.

---

## ⚡ 2. Pipeline Unificado de Prospecção (Implementação Recente)

Historicamente, o sistema possuía múltiplas fontes desconectadas (OpenStreetMap, CNPJ local, Google Places, Apify). Como nenhuma fonte entrega nativamente WhatsApp, Instagram e Email juntos, o ecossistema foi unificado em um **pipeline em 3 camadas**:

```
[ Camada 1: Prospecção Inicial ]
  - Fonte Principal: Apify Google Maps Scraper (ou Google Places/OSM)
  - Extrai: Nome, Categoria, Telefone Comercial, Endereço, Website, Rating.

[ Camada 2: Enriquecimento Web Automático ]
  - Core: src/lib/lead-sources/enrichment-pipeline.ts
  - Processo: Varre o website da empresa em background (concorrência 5x)
  - Extrai:
      • WhatsApp (links wa.me, api.whatsapp.com) -> Campo `whatsapp` + status 'confirmed'
      • Instagram (perfis instagram.com/) -> `instagram_handle`, `instagram_url`
      • Email corporativo (mailto: ou regex no HTML) -> `email`

[ Camada 3: Qualificação & Persistência ]
  - Classificação e cálculo de pontuação (lead-qualification)
  - Batch insert com deduplicação em massa no Turso (`createManyLeads`)
```

### 🔗 Rotas Relevantes do Pipeline
- `app/api/lead-sources/apify/run/start/route.ts`: Inicia o actor no Apify.
- `app/api/lead-sources/apify/runs/[runId]/route.ts`: Polling de status da execução (timeout tolerante de 7.5 min).
- `app/api/lead-sources/apify/runs/[runId]/import/route.ts`: Importa os datasets do Apify e dispara automaticamente o enriquecimento de websites em segundo plano.
- `app/api/lead-sources/enrich/website/route.ts`: Endpoint POST para re-enriquecimento sob demanda de leads da sessão.

---

## 🛠️ 3. Otimizações de Banco e Performance Realizadas

1. **Eliminação do Gargalo N+1 em Leads (`createManyLeads`):**
   - Deduplicação em lote: resolve `source + source_place_id` em 1 query SQL única.
   - Batch insert agrupado em 1 único round-trip HTTP via `client.batch()`.
2. **Consultas com Índice em Vez de LIKE:**
   - Filtros de WhatsApp foram migrados de `raw_data LIKE '%whatsapp_status%'` (table scan) para `whatsapp_status IN ('confirmed', 'possible')` (índice nativo).
3. **Agrupamento de Deletes (`deleteLeads`):**
   - Cascata manual executada em 1 único `client.batch([del_messages, del_notes, del_leads])`.

---

## 🚦 4. Convenções e Regras Críticas para Novos Desenvolvedores

Ao criar novos módulos ou abrir Pull Requests, siga impreterivelmente estas regras:

1. **Sempre use `user_id` no Turso:**
   ```typescript
   // ❌ NUNCA FAÇA
   await client.execute("SELECT * FROM leads WHERE id = ?", [leadId]);
   
   // ✅ SEMPRE FAÇA
   await client.execute("SELECT * FROM leads WHERE user_id = ? AND id = ?", [userId, leadId]);
   ```
2. **Conexões LibSQL / Turso:**
   - Use `getTursoClient()` de `@/src/lib/turso/client`. Ele reaproveita conexões cacheadas em serverless.
   - Evite loops com `await client.execute()`. Agrupe sempre usando `client.batch(statements, "write")`.
3. **Novas Fontes de Lead (`LeadSourceId`):**
   - Sempre declare a nova fonte em `src/lib/lead-sources/types.ts` (`LeadSourceId`).
   - Registre o enum no Zod schema em `schemas/lead.ts` (`leadSourceSchema`).
   - Adicione os labels legíveis em `config/pipeline.ts` (`leadSourceLabels`) e `src/lib/analytics/summary.ts`.
4. **Sem Pacotes Pesados Desnecessários:**
   - Controle de concorrência assíncrona deve seguir utilitários leves nativos sem inflar `package.json`.

---

## 🗺️ 5. Roadmap e Próximas Features em Desenvolvimento

Para evitar conflito entre branches em desenvolvimento paralelo:

- [ ] **Feature A (Enriquecimento CNPJ Público / Fallback):**
  - Implementar consulta automática na API pública da Receita (`publica.cnpj.ws` ou BrasilAPI) para preencher Razão Social e Email caso a base local do Turso não esteja populada.
- [ ] **Feature B (Validação Ativa de WhatsApp):**
  - Conectar provedores reais (Evolution API / Z-API / Baileys) em `src/lib/lead-qualification/whatsapp-validation-provider.ts` para verificar se o número está ativo no WhatsApp antes do disparo.
- [ ] **Feature C (Disparo Automatizado em Funis):**
  - Engine de execução de etapas agendadas em `lead_funnel_states` utilizando Cron / background workers.
- [ ] **Feature D (Paginação Cursor no Turso):**
  - Substituir o limite estático de 500 itens em `listLeads` por paginação baseada em cursor (`WHERE created_at < ? LIMIT ?`).

---

## 💻 6. Comandos Úteis

```bash
# Instalação limpa
npm install

# Setup do Schema e Migrações no Turso
npm run turso:setup

# Validação estática / Typecheck
npx tsc --noEmit

# Build de produção (requer variáveis configuradas no .env.local)
npm run build
```
