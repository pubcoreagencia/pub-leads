# MASTER CONTEXT — PubLeads / LeadCore

Observação inicial: o código, README e UI ainda usam o nome **LeadCore**. O pedido atual usa **PubLeads**. Neste documento, trato ambos como o mesmo produto, mas essa inconsistência de naming deve ser resolvida antes de demo, venda ou deploy público.

## 1. Visão Geral

O PubLeads/LeadCore é um SaaS B2B de prospecção comercial voltado para encontrar empresas locais, organizar leads, gerenciar pipeline de vendas, gerar mensagens comerciais com IA e facilitar contato manual por WhatsApp.

O problema principal que o produto resolve é a dificuldade de encontrar empresas com dados de contato úteis, especialmente negócios que possuem telefone, mas não possuem site, e transformar esses contatos em oportunidades organizadas de venda.

O público-alvo são vendedores, agências de marketing, criadores de sites, prestadores de serviço B2B, consultores comerciais e pequenas operações comerciais que vendem para negócios locais.

A proposta de valor atual é:

- Buscar empresas por cidade, estado, categoria e fonte.
- Priorizar leads com telefone.
- Identificar empresas sem site.
- Salvar leads em uma base própria.
- Gerenciar os leads em tabela e pipeline Kanban.
- Gerar mensagens comerciais personalizadas.
- Abrir WhatsApp manualmente com mensagem pronta.
- Controlar planos, limites e uso.

A visão do produto é ser uma ferramenta de prospecção simples, prática e focada em ação: encontrar empresas, salvar contatos, organizar abordagem e vender serviços.

Os diferenciais já encaminhados são:

- Uso de fontes abertas e oficiais sempre que possível.
- CNPJ Brasil como fonte estratégica de dados públicos.
- OpenStreetMap/Overpass como fonte inicial gratuita.
- Google Places preparado somente via API oficial.
- WhatsApp manual por `wa.me`, sem automação proibida.
- Pipeline comercial integrado ao buscador.
- Billing mock e controle de limites por plano.
- Arquitetura migrada para Turso nos dados volumosos de leads.

## 2. Arquitetura Geral

A aplicação é um projeto **Next.js 15 com App Router**.

### Frontend

O frontend fica principalmente em:

- `app/`
- `components/`
- `config/`
- `hooks/`
- `schemas/`

As páginas usam Server Components quando dependem de sessão e dados iniciais, e Client Components para telas interativas como scraper, leads, pipeline, WhatsApp e billing.

A UI segue uma estética SaaS clara, com fundo branco/cinza claro, roxo como cor principal e dourado para plano vitalício.

### Backend

O backend é implementado com Route Handlers do Next.js em:

- `app/api/**/route.ts`

Essas rotas fazem:

- autenticação via Supabase;
- validação de entrada com Zod;
- busca em fontes externas;
- persistência no Turso;
- leitura de perfil/plano no Supabase;
- geração de mensagens;
- checkout mock;
- webhook mock.

Não existe backend separado em Node/Express. O backend é acoplado ao Next.js.

### Banco

A arquitetura atual está dividida em dois bancos:

### Supabase

Usado para:

- autenticação;
- perfis;
- planos;
- assinaturas;
- pagamentos.

Tabelas esperadas:

- `profiles`
- `plans`
- `subscriptions`
- `payments`

O Supabase continua sendo a fonte de verdade para identidade do usuário e plano atual.

### Turso/libSQL

Usado para dados volumosos de prospecção:

- `leads`
- `lead_notes`
- `lead_messages`
- `search_logs`
- `cnpj_establishments`

A migração para Turso reduz pressão no Supabase e prepara o sistema para bases grandes de CNPJ e leads.

### Autenticação

A autenticação usa Supabase Auth.

Fluxo principal:

1. Usuário cria conta em `/register`.
2. Supabase cria usuário em `auth.users`.
3. Trigger SQL cria registro em `profiles`.
4. Usuário entra em `/login`.
5. Layout protegido em `app/app/layout.tsx` verifica sessão.
6. Rotas `/app/**` só renderizam se houver usuário autenticado.
7. APIs também chamam `supabase.auth.getUser()`.

### Storage

Não há Supabase Storage ou upload de arquivos implementado.

CSV upload foi planejado para futuro, mas ainda não existe.

### Deploy

O projeto está preparado para Vercel:

- `vercel.json`
- `.vercelignore`
- variáveis de ambiente necessárias
- build Next.js padrão

Há risco de timeout em Vercel se alguma rota fizer processamento pesado, especialmente busca externa ou importação. Importação de CNPJ não deve rodar em função serverless.

### Fluxo de dados

Fluxo típico:

1. Usuário autenticado acessa `/app/scraper`.
2. Frontend chama API de fonte de leads.
3. API valida sessão e limites.
4. API consulta CNPJ, Overpass, Google Places ou agregador interno.
5. API registra `search_logs`.
6. Usuário salva leads.
7. API `/api/leads/save` deduplica e grava no Turso.
8. Tabela, pipeline, dashboard e analytics leem do Turso.
9. Perfil/plano continuam vindo do Supabase.

### Fluxo das requisições

Public pages:

- `/`
- `/login`
- `/register`
- `/forgot-password`

Protected pages:

- `/app/**`

APIs protegidas:

- `/api/leads/**`
- `/api/lead-sources/**`
- `/api/ai/**`
- `/api/billing/**`

A maioria das APIs usa Supabase somente para descobrir `user.id`, depois acessa Turso filtrando por `user_id`.

## 3. Estrutura Completa de Pastas

### Raiz

Arquivos principais:

- `package.json`: scripts, dependências e versão das libs.
- `next.config.ts`: configuração Next.
- `tsconfig.json`: TypeScript.
- `tailwind.config.ts`: Tailwind.
- `eslint.config.mjs`: ESLint.
- `components.json`: configuração shadcn/ui.
- `middleware.ts`: middleware de sessão Supabase.
- `vercel.json`: configuração de deploy Vercel.
- `.env.example`: variáveis esperadas.
- `.gitignore`: deve manter `.env.local` fora do Git.
- `.vercelignore`: impede upload de arquivos pesados como dados CNPJ.
- `README.md`: setup resumido.
- `AGENTS.md`: regras de desenvolvimento do projeto.

### `app/`

Contém as rotas do App Router.

Arquivos importantes:

- `app/layout.tsx`: layout raiz.
- `app/globals.css`: estilos globais.
- `app/(public)/layout.tsx`: layout público.
- `app/(public)/page.tsx`: landing page.
- `app/(public)/login/page.tsx`: login.
- `app/(public)/register/page.tsx`: cadastro.
- `app/(public)/forgot-password/page.tsx`: recuperação.
- `app/auth/confirm/route.ts`: confirmação Supabase Auth.
- `app/app/layout.tsx`: layout protegido.
- `app/app/page.tsx`: redireciona para dashboard.
- `app/app/dashboard/page.tsx`: dashboard.
- `app/app/scraper/page.tsx`: buscador de leads.
- `app/app/leads/page.tsx`: tabela de leads.
- `app/app/pipeline/page.tsx`: Kanban.
- `app/app/whatsapp/page.tsx`: WhatsApp manual.
- `app/app/analytics/page.tsx`: gráficos.
- `app/app/billing/page.tsx`: planos/checkout.
- `app/app/planos/page.tsx`: uso e limites.
- `app/app/config/page.tsx`: placeholder de configurações.

### `app/api/`

Backend da aplicação.

Principais grupos:

- `app/api/leads/`: CRUD de leads.
- `app/api/leads/save/`: salvar leads externos em lote.
- `app/api/leads/enrich/cnpj/`: enriquecimento CNPJ.
- `app/api/lead-sources/cnpj/search/`: busca na base CNPJ.
- `app/api/lead-sources/overpass/`: busca OpenStreetMap/Overpass.
- `app/api/lead-sources/google-places/`: busca Google Places oficial.
- `app/api/lead-sources/site-sales/search/`: fonte agregada para empresas com telefone e sem site.
- `app/api/ai/lead-message/`: geração de mensagem.
- `app/api/billing/checkout/`: checkout mock.
- `app/api/billing/webhook/`: webhook mock.

### `components/`

Componentes reutilizáveis.

Subpastas:

- `components/ui/`: base shadcn-like.
- `components/layout/`: layout público, shell, sidebar, header.
- `components/auth/`: formulário de autenticação.
- `components/scraper/`: tela do buscador.
- `components/leads/`: tabela e modal de lead.
- `components/pipeline/`: Kanban.
- `components/whatsapp/`: fluxo de mensagem.
- `components/billing/`: cards e tela de billing.
- `components/plans/`: página de planos.
- `components/dashboard/`: dashboard.
- `components/analytics/`: gráficos.

### `config/`

Configurações declarativas:

- `navigation.ts`: itens da sidebar.
- `billing-plans.ts`: planos, preços, benefícios e limites.
- `lead-categories.ts`: categorias de busca.
- `pipeline.ts`: colunas/status do pipeline.
- `whatsapp.ts`: tons e objetivos.

### `schemas/`

Validação e tipos derivados:

- `schemas/auth.ts`: schema do formulário auth.
- `schemas/lead.ts`: schema de lead, status, source e tipo `Lead`.

### `services/`

Camada client-side legada/simples:

- `services/leads.ts`: funções para chamar APIs de leads pelo frontend.

### `lib/`

Utilitários gerais e Supabase:

- `lib/utils.ts`: helper `cn`.
- `lib/supabase/client.ts`: cliente browser.
- `lib/supabase/server.ts`: cliente server.
- `lib/supabase/admin.ts`: cliente service role.
- `lib/supabase/config.ts`: valida configuração Supabase.
- `lib/supabase/middleware.ts`: refresh de sessão.

### `src/lib/`

Camada de domínio e integrações.

Principais áreas:

- `src/lib/turso/`: client, schema, repositories e mappers.
- `src/lib/lead-sources/`: CNPJ, Overpass, Google Places e contratos.
- `src/lib/ai/`: OpenAI/fallback.
- `src/lib/whatsapp/`: wa.me e providers.
- `src/lib/billing/`: billing mock.
- `src/lib/usage/`: limites por plano.
- `src/lib/analytics/`: agregações para dashboard/analytics.

### `supabase/`

SQLs e migrations.

Arquivos:

- `supabase/lightweight-schema.sql`: schema atual recomendado para Supabase leve.
- `supabase/full-setup.sql`: setup completo legado.
- `supabase/schema.sql`: versão anterior do schema.
- `supabase/add-cnpj-enrichment-fields.sql`: migration antiga para campos CNPJ.

### `scripts/`

Automação local.

Arquivos:

- `scripts/setup-turso.ts`: cria schema Turso.
- `scripts/import-cnpj-csv.ts`: importa arquivos oficiais da Receita para Turso.
- `scripts/migrate-leads-supabase-to-turso.ts`: migra leads do Supabase para Turso.
- `scripts/verify-turso-migration.ts`: compara migração.
- `scripts/download-cnpj-data.ps1`: baixa dados da Receita.
- `scripts/cleanup-supabase-leads.sql`: limpeza manual após migração.

### `docs/`

Documentação técnica:

- `docs/cnpj-import.md`: fluxo de importação CNPJ.
- `docs/google-places.md`: uso da API oficial Google Places.

## 4. Tecnologias

Principais dependências conforme `package.json`:

- Next.js: `^15.0.0`
- React: `^19.0.0`
- React DOM: `^19.0.0`
- TypeScript: `^5`
- Tailwind CSS: `^3.4.1`
- shadcn/ui style via Radix Slot/CVA/Tailwind:
  - `@radix-ui/react-slot`
  - `class-variance-authority`
  - `tailwind-merge`
  - `tailwindcss-animate`
- lucide-react: `^0.468.0`
- Supabase:
  - `@supabase/supabase-js ^2.47.0`
  - `@supabase/ssr ^0.12.0`
- React Hook Form: `^7.54.0`
- Zod: `^3.24.0`
- dnd-kit:
  - `@dnd-kit/core ^6.1.0`
  - `@dnd-kit/sortable ^8.0.0`
  - `@dnd-kit/utilities ^3.2.2`
- Recharts: `^3.0.0`
- Turso/libSQL:
  - `@libsql/client ^0.17.4`
- tsx: usado para scripts TypeScript.

Scripts:

- `npm run dev`: desenvolvimento.
- `npm run build`: build de produção.
- `npm run start`: iniciar produção.
- `npm run lint`: ESLint.
- `npm run turso:setup`: criar schema Turso.
- `npm run turso:migrate`: migrar leads Supabase para Turso.
- `npm run turso:verify`: verificar migração.
- `npm test`: placeholder, ainda sem testes reais.

## 5. Banco de Dados

A arquitetura atual usa Supabase + Turso.

### Supabase

Responsável por:

- usuários;
- perfis;
- planos;
- assinaturas;
- pagamentos.

### Tabela `profiles`

Finalidade: dados do usuário.

Campos esperados:

- `id`
- `email`
- `full_name`
- `company_name`
- `current_plan_id`
- `created_at`
- `updated_at`

Relacionamentos:

- `profiles.id` corresponde ao usuário Supabase Auth.
- `current_plan_id` referencia `plans.id`.

### Tabela `plans`

Finalidade: catálogo de planos.

Planos seed:

- `free`
- `mensal`
- `anual`
- `vitalicio`

Campos esperados:

- `id`
- `name`
- `slug`
- `price`
- `billing_cycle`
- `features`
- `limits`
- `is_active`
- `created_at`
- `updated_at`

Uso atual:

- Leitura por usuários autenticados.
- Usada para mostrar plano atual e limites.

### Tabela `subscriptions`

Finalidade: assinatura do usuário.

Campos esperados:

- `id`
- `user_id`
- `plan_id`
- `status`
- `started_at`
- `expires_at`
- `created_at`
- `updated_at`

Uso atual:

- Lida pelo usuário dono.
- Atualizada pelo webhook mock.

### Tabela `payments`

Finalidade: registro financeiro.

Campos esperados:

- `id`
- `user_id`
- `plan_id`
- `amount`
- `status`
- `provider`
- `provider_payment_id`
- `created_at`

Uso atual:

- Lido pelo usuário dono.
- Inserido no webhook mock.

### Policies Supabase

Regras esperadas:

- `plans`: leitura por usuários autenticados.
- `profiles`: usuário lê e atualiza apenas seu próprio profile.
- `subscriptions`: usuário lê apenas suas próprias assinaturas.
- `payments`: usuário lê apenas seus próprios pagamentos.
- Service role pode executar operações administrativas.

### Triggers Supabase

Trigger importante:

- criação automática de `profiles` após cadastro em `auth.users`.

Funções esperadas:

- `handle_new_user()`
- `set_updated_at()`

### Turso/libSQL

Responsável por dados de prospecção.

Schema em:

- `src/lib/turso/schema.sql`

### Tabela `leads`

Finalidade: leads do usuário.

Campos principais:

- `id`
- `user_id`
- `name`
- `business_name`
- `fantasy_name`
- `cnpj`
- `category`
- `cnae`
- `cnae_description`
- `phone`
- `phone_2`
- `email`
- `website`
- `address`
- `city`
- `state`
- `country`
- `latitude`
- `longitude`
- `source`
- `source_place_id`
- `source_url`
- `rating`
- `reviews_count`
- `status`
- `score`
- `enrichment_source`
- `enrichment_confidence`
- `raw_data`
- `raw_cnpj_data`
- `created_at`
- `updated_at`

Status do pipeline:

- `new`
- `qualified`
- `contacted`
- `replied`
- `proposal`
- `closed`
- `lost`

Índices relevantes:

- `user_id`
- `status`
- `city`
- `state`
- `category`
- `source`
- `source_place_id`
- `cnpj`
- `phone`
- `created_at`

Há índice único parcial por usuário, fonte e `source_place_id`.

### Tabela `lead_notes`

Campos:

- `id`
- `lead_id`
- `user_id`
- `note`
- `created_at`

Relacionamento:

- `lead_id` referencia `leads.id`.

### Tabela `lead_messages`

Campos:

- `id`
- `lead_id`
- `user_id`
- `message`
- `tone`
- `objective`
- `created_at`

Finalidade:

- armazenar mensagens geradas por IA/fallback.

### Tabela `search_logs`

Campos:

- `id`
- `user_id`
- `query`
- `city`
- `state`
- `country`
- `category`
- `result_count`
- `source`
- `status`
- `raw_params`
- `created_at`

Uso:

- auditoria de buscas;
- cálculo de limite mensal;
- dashboard e analytics.

### Tabela `cnpj_establishments`

Campos principais:

- `cnpj`
- `cnpj_basico`
- `cnpj_ordem`
- `cnpj_dv`
- `is_headquarters`
- `razao_social`
- `nome_fantasia`
- `situacao_cadastral`
- `data_situacao_cadastral`
- `data_inicio_atividade`
- `cnae_fiscal`
- `cnae_fiscal_descricao`
- `tipo_logradouro`
- `logradouro`
- `numero`
- `complemento`
- `bairro`
- `cep`
- `uf`
- `municipio`
- `ddd_1`
- `telefone_1`
- `ddd_2`
- `telefone_2`
- `email`
- `raw_data`
- `created_at`
- `updated_at`

Uso:

- busca local em dados públicos da Receita;
- enriquecimento de leads existentes.

Limitação atual:

- o importador baseado somente em Estabelecimentos não preenche plenamente `razao_social`, porque esse dado completo depende dos arquivos de Empresas.

## 6. Autenticação

A autenticação usa Supabase Auth.

### Cadastro

Arquivo:

- `components/auth/AuthForm`

Fluxo:

1. Usuário preenche nome, email e senha.
2. Formulário valida com `authFormSchema`.
3. Browser Supabase executa `signUp`.
4. Metadata inclui `full_name`.
5. Redirect de confirmação aponta para `/auth/confirm?next=/app/dashboard`.
6. Supabase envia email conforme configuração do projeto.
7. Trigger SQL cria `profiles`.

### Login

Fluxo:

1. Usuário informa email e senha.
2. `signInWithPassword`.
3. Em sucesso, redireciona para `redirectTo` ou `/app/dashboard`.

### Recuperação de senha

Fluxo:

1. Usuário informa email.
2. `resetPasswordForEmail`.
3. Redirect atual aponta para `/auth/confirm?next=/login`.

Ponto incompleto:

- não há tela própria de redefinição de senha nova. O fluxo pode não estar completo dependendo da configuração do Supabase.

### Proteção de rotas

Arquivo:

- `app/app/layout.tsx`

O layout protegido:

1. Verifica se Supabase está configurado.
2. Cria client server.
3. Chama `supabase.auth.getUser()`.
4. Redireciona para login se não houver usuário.
5. Carrega profile e plano.
6. Renderiza `DashboardShell`.

### Middleware

Arquivos:

- `middleware.ts`
- `lib/supabase/middleware.ts`

O middleware roda para:

- `/app/:path*`

Ele atualiza sessão/cookies com `@supabase/ssr`.

Detalhe importante:

- há timeout de 1500ms na chamada `getUser()` para evitar travar middleware.

### APIs

As APIs protegidas fazem:

1. `createSupabaseServerClient()`
2. `supabase.auth.getUser()`
3. rejeitam se não houver usuário.
4. usam `user.id` server-side.

Isso é correto. Não dependem de `userId` vindo do body.

## 7. Dashboard

### `/`

Landing page pública.

Status: funcional, porém simples.

Mostra proposta do produto e CTAs.

### `/login`

Status: funcional se Supabase estiver configurado.

Problemas conhecidos:

- mensagens de erro podem ser pouco claras.
- fluxo depende de variáveis corretas do Supabase.

### `/register`

Status: funcional em estrutura.

Depende da configuração de confirmação de email no Supabase.

### `/forgot-password`

Status: parcial.

Solicitação de reset existe, mas falta tela de definir nova senha.

### `/app/dashboard`

Status: funcional.

Mostra:

- métricas de leads;
- buscas;
- uso de plano;
- distribuição de pipeline;
- leads recentes.

Dados vêm do Turso e Supabase.

### `/app/scraper`

Status: funcional em arquitetura.

Fontes disponíveis:

- `site_sales`
- `cnpj_brasil`
- `openstreetmap`
- `google_places`

Observação: “scraper” é o nome da tela, mas o ideal técnico/legal é tratá-la como buscador de fontes oficiais/dados abertos.

### `/app/leads`

Status: funcional.

Recursos:

- filtros;
- tabela;
- abrir detalhes;
- editar;
- excluir;
- adicionar nota;
- enriquecer via CNPJ.

### `/app/pipeline`

Status: funcional.

Usa dnd-kit.

Arrastar card atualiza status no Turso.

### `/app/whatsapp`

Status: funcional no MVP.

Gera mensagem e abre link `wa.me`.

Não envia mensagem automaticamente.

### `/app/analytics`

Status: funcional.

Usa Recharts.

Mostra gráficos agregados.

### `/app/billing`

Status: parcial.

Cards de plano funcionam.

Checkout é mock.

Se envs apontarem para rotas inexistentes, haverá 404.

### `/app/planos`

Status: funcional.

Mostra plano atual, uso e comparação.

### `/app/config`

Status: placeholder.

Ainda não possui configurações reais.

## 8. Componentes

### `components/layout/PublicLayout`

Responsável pelo layout público.

Mostra header, navegação e área de conteúdo.

Depende de Next Link e estilos Tailwind.

### `components/layout/DashboardShell`

Responsável pelo shell protegido.

Entradas:

- `children`
- `userName`
- `currentPlan`

Saída:

- layout com sidebar, header e conteúdo.

Inclui responsividade mobile.

### `components/layout/DashboardSidebar`

Responsável pela navegação lateral.

Depende de:

- `config/navigation.ts`
- `lucide-react`
- `usePathname`

Item ativo usa fundo roxo claro e texto roxo.

### `components/layout/DashboardHeader`

Responsável pelo topo interno.

Mostra:

- campo de busca visual;
- ícone de notificação;
- nome do usuário;
- plano atual.

Pontos não funcionais:

- busca não executa ação;
- notificação não abre nada.

### `components/layout/DashboardPageShell`

Wrapper visual para páginas internas.

### `components/layout/RoutePlaceholder`

Placeholder usado em páginas incompletas.

### `components/auth/AuthForm`

Formulário único para:

- login;
- cadastro;
- recuperação.

Entradas:

- `mode`.

Depende de:

- Supabase browser client;
- React Hook Form;
- Zod;
- toast;
- router.

### `components/auth/AuthCard`

Componente legado/estático.

Parece não ser o fluxo principal atual.

### `components/ui/Button`

Botão estilo shadcn.

Suporta variantes e tamanhos.

### `components/ui/Card`

Componentes de card.

Usado em dashboard, billing e telas internas.

### `components/ui/Input`

Input base.

### `components/ui/Label`

Label base.

### `components/ui/Toast`, `Toaster`

Sistema simples de toast.

### `components/scraper/ScraperPageContent`

Tela principal de busca.

Responsabilidades:

- formulário de busca;
- seleção de fonte;
- chamada das APIs;
- loading/error/empty states;
- listagem de resultados;
- salvar lead;
- salvar todos.

Depende de:

- `config/lead-categories.ts`
- APIs `/api/lead-sources/**`
- `/api/leads/save`
- toast.

### `components/leads/LeadsPageContent`

Tela de leads.

Responsabilidades:

- carregar leads;
- aplicar filtros;
- mostrar tabela;
- abrir modal;
- enriquecer com CNPJ;
- empty/loading states.

Depende de:

- `services/leads.ts`
- `LeadDetailModal`.

### `components/leads/LeadDetailModal`

Modal customizado de detalhes.

Responsabilidades:

- visualizar lead;
- editar lead;
- excluir lead;
- listar notas;
- adicionar nota.

Depende de:

- `leadFormSchema`;
- APIs de lead e notas.

### `components/pipeline/PipelinePageContent`

Kanban.

Responsabilidades:

- buscar leads;
- agrupar por status;
- controlar drag and drop;
- atualizar status via API;
- rollback visual em caso de erro.

Depende de:

- dnd-kit;
- config de pipeline;
- `services/leads.ts`.

### `components/pipeline/PipelineColumn`

Coluna do Kanban.

Entrada:

- status/coluna;
- leads.

### `components/pipeline/PipelineCard`

Card arrastável.

Entrada:

- lead.

Mostra dados resumidos.

### `components/whatsapp/WhatsappPageContent`

Fluxo de mensagem.

Responsabilidades:

- selecionar lead;
- escolher tom;
- escolher objetivo;
- gerar mensagem;
- abrir WhatsApp.

Depende de:

- `/api/leads`
- `/api/ai/lead-message`
- `config/whatsapp.ts`.

### `components/billing/BillingPageContent`

Tela de billing.

Responsabilidades:

- renderizar planos pagos;
- chamar checkout mock;
- redirecionar para URL retornada.

### `components/billing/PlanCard`

Card de plano.

Entrada:

- dados do plano;
- callback de assinatura.

### `components/plans/PlansPageContent`

Tela de plano atual e uso.

Entrada:

- summary de uso;
- plano atual.

### `components/dashboard/DashboardPageContent`

Dashboard visual.

Entrada:

- resumo analítico.

### `components/analytics/AnalyticsPageContent`

Gráficos com Recharts.

Entrada:

- resumo analítico.

## 9. Serviços

### Supabase

Arquivos:

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/admin.ts`
- `lib/supabase/config.ts`
- `lib/supabase/middleware.ts`

Responsabilidades:

- cliente browser;
- cliente server;
- cliente admin com service role;
- validação de envs;
- refresh de sessão.

### Turso

Arquivos:

- `src/lib/turso/client.ts`
- `src/lib/turso/leads-repository.ts`
- `src/lib/turso/lead-notes-repository.ts`
- `src/lib/turso/lead-messages-repository.ts`
- `src/lib/turso/search-logs-repository.ts`
- `src/lib/turso/mappers.ts`
- `src/lib/turso/types.ts`

Responsabilidades:

- conexão com libSQL;
- CRUD de leads;
- notas;
- mensagens;
- logs;
- mapeamento row -> domínio;
- isolamento por `user_id`.

### Overpass/OpenStreetMap

Arquivo:

- `src/lib/lead-sources/overpass.ts`

Responsabilidades:

- geocodificar cidade via Nominatim;
- montar query Overpass;
- buscar empresas por categoria;
- normalizar dados;
- retornar `ExternalLead`.

Campos extraídos:

- nome;
- categoria;
- endereço;
- telefone;
- site;
- latitude;
- longitude;
- cidade;
- estado;
- país;
- fonte.

Limitações:

- depende de serviço público;
- pode falhar por timeout;
- não tem cache;
- não tem retry robusto.

### CNPJ Brasil

Arquivo:

- `src/lib/lead-sources/cnpj-brasil.ts`

Responsabilidades:

- buscar empresas na tabela `cnpj_establishments`;
- filtrar por cidade, UF, CNAE, nome e telefone;
- montar endereço;
- normalizar telefone;
- enriquecer lead existente.

É uma das partes mais estratégicas do produto.

### Google Places

Arquivo:

- `src/lib/lead-sources/google-places.ts`

Responsabilidades:

- usar API oficial do Google Places;
- buscar empresas por texto;
- retornar telefone, site, rating, reviews e localização quando disponível.

Importante:

- não faz scraping direto do Google Maps.
- é integração oficial.
- depende de API key e billing Google.
- deve continuar opcional.

### Site Sales

Endpoint:

- `app/api/lead-sources/site-sales/search/route.ts`

Responsabilidade:

- combinar CNPJ e OpenStreetMap;
- priorizar empresas com telefone;
- priorizar empresas sem site;
- deduplicar resultados;
- ranquear leads.

Essa rota está mais alinhada ao objetivo comercial atual: encontrar telefone de empresas para vender site/serviços.

### AI/OpenAI

Arquivo:

- `src/lib/ai/openai.ts`

Funções:

- `generateLeadMessage`
- `generateFollowUp`
- `classifyLead`

Comportamento:

- se `OPENAI_API_KEY` existe, chama OpenAI Responses API;
- se não existe, retorna mensagens mockadas úteis.

### WhatsApp

Arquivos:

- `src/lib/whatsapp/wa-link.ts`
- `src/lib/whatsapp/provider.ts`
- `src/lib/whatsapp/cloud-api.ts`

Comportamento:

- gera link `wa.me`;
- Cloud API existe apenas como arquitetura futura;
- não envia mensagem automaticamente.

### Billing

Arquivos:

- `src/lib/billing/types.ts`
- `src/lib/billing/mock-provider.ts`
- `src/lib/billing/provider.ts`

Comportamento:

- cria checkout mock;
- usa envs:
  - `CHECKOUT_MENSAL_URL`
  - `CHECKOUT_ANUAL_URL`
  - `CHECKOUT_VITALICIO_URL`

### Usage/Limits

Arquivo:

- `src/lib/usage/limits.ts`

Funções:

- `getCurrentPlan`
- `canSearch`
- `canCreateLead`
- `incrementSearchUsage`
- `getUsageSummary`

Limites:

- Free: 100 leads, 5 buscas/mês.
- Mensal: 10.000 leads, 50 buscas/mês.
- Anual: ilimitado em leads/buscas.
- Vitalício: tudo liberado.

### Analytics

Arquivo:

- `src/lib/analytics/summary.ts`

Responsabilidade:

- agregar métricas de leads, fontes, pipeline, categorias e buscas.

## 10. Hooks

### `hooks/use-toast.ts`

Hook simples de toast.

Fornece:

- estado global local;
- função `toast`;
- dismiss;
- lista de toasts.

É usado em formulários, scraper, leads, billing e WhatsApp.

Não há outros hooks relevantes documentados.

## 11. Schemas

### `schemas/auth.ts`

Contém:

- `authFormSchema`
- tipo `AuthFormValues`

Valida:

- email obrigatório;
- nome opcional, mas validado quando presente;
- senha opcional, mas com mínimo quando presente.

É usado pelo `AuthForm`.

### `schemas/lead.ts`

Contém:

- `leadStatusSchema`
- `leadSourceSchema`
- `leadFormSchema`
- tipo `LeadStatus`
- tipo `LeadSource`
- tipo `LeadFormValues`
- tipo `Lead`

Valida:

- nome;
- empresa;
- categoria;
- telefone;
- WhatsApp;
- email;
- site;
- endereço;
- cidade;
- estado;
- país;
- status;
- source.

Observação:

- o tipo `Lead` mantém campos legados como `company`, `external_id`, `whatsapp`, `pipeline_stage` e `metadata`, mapeados a partir do Turso.

### Schemas nas APIs

Além dos arquivos centrais, várias APIs possuem schemas internos Zod:

- busca CNPJ;
- busca Overpass;
- busca Google Places;
- busca Site Sales;
- salvar leads externos;
- gerar mensagem;
- checkout;
- status do pipeline;
- notas.

Isso é positivo e deve ser mantido.

## 12. Sistema de Scraping

O sistema atual deve ser entendido como um **sistema de prospecção por fontes oficiais e abertas**, não como scraping proibido.

### Fontes implementadas

### 1. CNPJ Brasil

Fonte:

- dados públicos da Receita Federal importados para Turso.

Arquivos principais:

- `scripts/import-cnpj-csv.ts`
- `src/lib/lead-sources/cnpj-brasil.ts`
- `app/api/lead-sources/cnpj/search/route.ts`

Fluxo:

1. Arquivos da Receita são baixados localmente.
2. Script importa CSVs para `cnpj_establishments`.
3. Usuário busca cidade, estado, categoria/CNAE ou termo.
4. API consulta Turso.
5. Resultados são normalizados em `ExternalLead`.
6. Usuário salva leads.
7. Leads vão para tabela `leads`.

Pontos fortes:

- fonte gratuita;
- legalmente defensável;
- cobre empresas reais;
- possui telefone e email quando declarados.

Limitações:

- dados podem estar desatualizados;
- muitas empresas não têm telefone;
- import atual não preenche completamente razão social;
- busca textual com LIKE pode ficar lenta com Brasil inteiro.

### 2. OpenStreetMap/Overpass

Fonte:

- OpenStreetMap via Overpass API.

Arquivos:

- `src/lib/lead-sources/overpass.ts`
- `app/api/lead-sources/overpass/route.ts`

Fluxo:

1. Usuário informa cidade, estado, país, categoria, raio e limite.
2. API geocodifica cidade.
3. Monta query Overpass por categoria.
4. Busca nodes/ways/relations.
5. Normaliza tags.
6. Retorna leads.
7. Usuário salva.

Pontos fortes:

- gratuito;
- bom para negócios locais cadastrados no mapa;
- traz endereço, site, telefone em alguns casos.

Limitações:

- telefone nem sempre existe;
- depende de qualidade da comunidade OSM;
- API pública pode limitar/timeout;
- sem cache e sem fila.

### 3. Google Places Oficial

Fonte:

- Google Places API oficial.

Arquivos:

- `src/lib/lead-sources/google-places.ts`
- `app/api/lead-sources/google-places/route.ts`

Fluxo:

1. Usuário seleciona Google Places.
2. API valida env.
3. Chama Places Text Search.
4. Retorna empresas com telefone/site/rating quando Google fornece.
5. Usuário salva.

Ponto crucial:

- isso não é scraping direto do Google Maps.
- é integração oficial.
- depende de cobrança/billing Google.

### 4. Site Sales

Fonte agregada:

- CNPJ + OSM.

Endpoint:

- `app/api/lead-sources/site-sales/search/route.ts`

Objetivo:

- encontrar empresas com telefone e sem site para vender sites.

Fluxo:

1. Recebe cidade, estado, categoria e filtros.
2. Busca CNPJ.
3. Busca Overpass.
4. Deduplica.
5. Rankeia.
6. Retorna oportunidades.

Esse é o fluxo mais alinhado ao uso comercial atual: encontrar telefone de empresas para vender site/serviços.

### Pipeline de salvamento

Endpoint:

- `app/api/leads/save/route.ts`

Fluxo:

1. Recebe lista de leads externos.
2. Valida com Zod.
3. Remove duplicados dentro da requisição.
4. Verifica duplicidade no Turso por:
   - source/source_place_id;
   - CNPJ;
   - telefone.
5. Verifica limite de plano.
6. Insere novos leads.
7. Retorna salvos e ignorados.

### Melhorias necessárias

Alta prioridade:

- melhorar importação CNPJ para incluir Empresas e razão social;
- implementar busca full-text no Turso ou mecanismo auxiliar;
- adicionar cache para Overpass;
- adicionar rate limit;
- melhorar mensagens de erro por fonte;
- separar claramente “busca oficial” de “scraping” na UI;
- criar worker externo para importação Brasil inteiro.

## 13. Fluxo Completo do Sistema

### 1. Login

Usuário acessa `/login`.

O formulário usa Supabase Auth.

Se credenciais forem válidas, redireciona para `/app/dashboard`.

### 2. Dashboard

Dashboard carrega dados via `getAnalyticsSummary`.

Mostra resumo de operação:

- leads;
- buscas;
- pipeline;
- fontes;
- uso do plano.

### 3. Busca

Usuário vai para `/app/scraper`.

Seleciona fonte, cidade, estado, categoria e limite.

### 4. Scraping/prospecção

Frontend chama API da fonte:

- CNPJ;
- OpenStreetMap;
- Google Places;
- Site Sales.

API valida usuário e plano.

### 5. Processamento

A fonte retorna dados brutos.

O serviço normaliza em formato comum:

- nome;
- telefone;
- site;
- endereço;
- cidade;
- estado;
- fonte;
- coordenadas;
- metadata.

### 6. Armazenamento

Usuário clica “Salvar lead” ou “Salvar todos”.

Endpoint `/api/leads/save` salva no Turso.

### 7. Exibição

Usuário vê os leads em `/app/leads`.

Pode filtrar, editar, excluir e adicionar notas.

### 8. Pipeline

Usuário acessa `/app/pipeline`.

Arrasta cards entre colunas.

API atualiza `status`.

### 9. Mensagem

Usuário acessa `/app/whatsapp`.

Seleciona lead, tom e objetivo.

API gera mensagem e salva em `lead_messages`.

### 10. WhatsApp

Frontend abre link `wa.me`.

Envio continua manual.

### 11. Billing

Usuário acessa `/app/billing`.

Escolhe plano.

API retorna URL mock de checkout.

### 12. Planos

Usuário acessa `/app/planos`.

Vê plano atual, limites e uso.

### 13. Analytics

Usuário acessa `/app/analytics`.

Vê gráficos agregados.

### Exportação

Ainda não existe exportação CSV/Excel implementada.

## 14. Estado Atual do Projeto

### 100% pronto ou bem encaminhado

- Base Next.js App Router.
- Layout público.
- Layout interno protegido.
- Sidebar/header responsivos.
- Auth Supabase em estrutura.
- CRUD de leads via APIs.
- Persistência de leads no Turso.
- Pipeline Kanban com dnd-kit.
- Busca CNPJ via base local Turso.
- Busca OSM/Overpass.
- Google Places oficial preparado.
- Geração de mensagem com OpenAI/fallback.
- WhatsApp manual via `wa.me`.
- Billing mock.
- Controle básico de limites.
- Dashboard e analytics.
- Scripts de Turso.
- SQL Supabase leve.
- Documentação inicial.

### Funcionando parcialmente

- Billing: mock, sem checkout real.
- Webhook: mock e autenticado, não serve para provider real.
- CNPJ Brasil: depende de import completo e qualidade dos CSVs.
- Overpass: funcional, mas sujeito a timeout/limite externo.
- Google Places: depende de chave e billing Google.
- Forgot password: falta página de nova senha.
- Configurações: placeholder.
- Analytics: agrega em memória.
- Busca Site Sales: boa ideia, mas depende das fontes.

### Quebrado ou com risco

- Encoding de textos em português com caracteres corrompidos.
- Rotas `/checkout/*` podem não existir.
- Importação Brasil inteiro pode ser pesada demais sem estratégia.
- CNPJ sem razão social completa reduz qualidade.
- Sem rate limiting.
- Sem testes automatizados reais.
- Sem exportação.
- Sem logout visível.
- Busca visual do header não funciona.

### Ainda não existe

- CSV upload.
- Exportação CSV/Excel.
- Checkout real.
- WhatsApp Cloud API real.
- Google Places com billing configurado no produto.
- Admin panel.
- Gestão de equipe/workspaces.
- Notificações reais.
- Fila/worker para buscas/importação.
- Observabilidade.
- Testes E2E.

## 15. Pendências

### Alta prioridade

- Corrigir encoding/mojibake dos textos.
- Garantir Supabase `lightweight-schema.sql` aplicado corretamente.
- Garantir Turso schema aplicado.
- Importar CNPJ de forma confiável.
- Melhorar importador para Empresas + Estabelecimentos.
- Resolver rotas inexistentes de checkout mock.
- Adicionar rate limit nas APIs.
- Implementar logout.
- Melhorar tratamento de erro do login.
- Criar tela real de reset de senha.
- Validar deploy Vercel sem timeout.
- Confirmar `.env.local` fora do Git.
- Remover ou esconder Google Places quando sem chave.

### Média prioridade

- Criar exportação CSV.
- Criar filtros avançados.
- Criar histórico de mensagens por lead na UI.
- Adicionar exclusão de notas na UI.
- Melhorar deduplicação por telefone/CNPJ.
- Adicionar cache para Overpass.
- Criar paginação real de leads.
- Criar busca full-text no CNPJ.
- Adicionar testes de APIs.
- Criar observabilidade/logs.
- Criar documentação de operação do CNPJ.

### Baixa prioridade

- Melhorar landing page.
- Adicionar tema dark opcional.
- Adicionar atalhos de teclado.
- Adicionar onboarding.
- Criar templates de mensagens.
- Melhorar gráficos.
- Adicionar configurações de empresa.

## 16. Bugs conhecidos

- Textos em português aparecem com encoding quebrado em diversos arquivos.
- `/checkout/mensal`, `/checkout/anual` e `/checkout/vitalicio` podem dar 404.
- Webhook mock depende de usuário autenticado, inviável para webhook externo real.
- Forgot password não tem tela completa para nova senha.
- Header search é apenas visual.
- Ícone de notificação é apenas visual.
- Config page é placeholder.
- Notes têm API de delete, mas não UI.
- `Lead.whatsapp` é mapeado a partir de `phone`; não há campo separado real.
- APIs de lead por ID exigem UUID, embora Turso use `TEXT`.
- Deduplicação por telefone pode juntar empresas diferentes.
- Busca CNPJ com Brasil inteiro pode ficar lenta.
- CNPJ importado sem Empresas reduz dados de razão social.
- Sem tratamento robusto para timeout de Overpass.
- Mensagens de erro podem retornar `{}` em alguns cenários de auth.

## 17. Débito Técnico

- Mistura de nome LeadCore/PubLeads.
- Arquivos SQL legados ainda existem junto ao schema atual.
- Supabase full setup e Turso schema podem confundir novos devs.
- `LEADS_DB_PROVIDER` existe, mas não parece controlar provider na prática.
- Aggregations de analytics são feitas em memória.
- Sem camada formal de logging.
- Sem testes.
- Sem paginação robusta.
- Sem contracts compartilhados para todas as APIs.
- Muitos textos hardcoded.
- Alguns componentes fazem bastante trabalho de estado e fetch.
- CNPJ import ainda é script local, não pipeline operacional.
- Billing mock não modela provider real.
- Webhook precisa redesign.
- UI usa componentes shadcn mínimos, não biblioteca completa.

## 18. Melhorias Arquiteturais

Recomendações:

- Padronizar nome do produto: PubLeads ou LeadCore.
- Separar “fontes de leads” em registry plugável.
- Criar camada de jobs para buscas pesadas e importação.
- Usar fila para Overpass, CNPJ enrichment e futuras fontes.
- Introduzir cache por cidade/categoria/fonte.
- Criar paginação por cursor em `leads`.
- Criar FTS para CNPJ.
- Separar analytics em queries agregadas no banco.
- Transformar billing mock em interface real com provider.
- Criar webhook sem auth de usuário, com assinatura.
- Adicionar camada de auditoria.
- Criar feature flags para fontes pagas.
- Centralizar tratamento de erro das APIs.
- Criar tipos compartilhados para API responses.
- Adicionar testes unitários para services e repositories.
- Adicionar Playwright para fluxo completo.

## 19. Segurança

### Pontos positivos

- Rotas `/app` são protegidas.
- APIs usam `supabase.auth.getUser()`.
- APIs não confiam em `userId` enviado pelo body.
- Supabase service role está em variável sem prefixo `NEXT_PUBLIC`.
- Validação com Zod existe em pontos críticos.
- WhatsApp não envia automaticamente.
- Não há scraping direto do Google Maps no código analisado.
- Turso repositories filtram por `user_id`.

### Riscos

- Turso não possui RLS. Segurança depende 100% da camada de aplicação.
- Sem rate limit.
- Sem proteção anti-abuso por IP.
- Sem CSP/security headers.
- Webhook mock não segue padrão seguro de webhook real.
- Erros podem vazar detalhes internos se não tratados.
- Importação CNPJ pode armazenar dados pessoais/contatos sensíveis de forma massiva.
- Falta política clara de retenção/remoção de dados.
- Sem logs de auditoria de deletes/updates.
- Sem RBAC ou workspaces.
- Sem sanitização específica além de React escaping e Zod.

### Recomendações

- Adicionar rate limit por usuário e IP.
- Criar middleware/API helper único de auth.
- Criar helper único para responses de erro.
- Adicionar headers de segurança.
- Implementar webhook real com assinatura.
- Evitar retornar raw data sensível desnecessária ao client.
- Revisar LGPD/base legal para uso de dados públicos de CNPJ.
- Registrar termos de uso antes de vender.

## 20. Performance

### Gargalos atuais

- CNPJ com `LIKE` em base muito grande.
- Analytics carregando muitos leads e agregando em memória.
- `createManyLeads` sequencial.
- Overpass sem cache.
- Nominatim chamado em tempo real.
- Recharts pode pesar com datasets grandes.
- Leads table sem paginação real.
- Importação Brasil inteiro pode ser muito lenta em ambiente inadequado.
- Vercel serverless pode dar timeout em buscas externas demoradas.

### Otimizações sugeridas

- Paginação por cursor.
- Full-text search para CNPJ.
- Índices específicos por UF, município, CNAE e telefone.
- Cache de resultados por fonte/cidade/categoria.
- Batch insert transacional no Turso.
- Pré-agregações de analytics.
- Debounce nos filtros.
- Virtualização de tabela.
- Timeout e retry controlados por fonte.
- Worker externo para import/importação pesada.

## 21. Escalabilidade

Para milhares de usuários, preservar:

- Supabase para auth e billing leve.
- Turso para dados volumosos.
- APIs stateless no Next/Vercel.

Mas será necessário adicionar:

- rate limiting distribuído;
- fila de jobs;
- workers externos;
- cache;
- FTS/search engine;
- paginação;
- observabilidade;
- isolamento por workspace;
- quotas por fonte;
- métricas por usuário;
- limites de payload;
- background enrichment;
- exportação assíncrona;
- storage para exports.

Para Brasil inteiro de CNPJ, avaliar:

- Turso com índices/FTS;
- Postgres dedicado;
- ClickHouse;
- Meilisearch/Typesense;
- pipeline ETL separado;
- particionamento por UF.

## 22. Roadmap

### Curto prazo

- Corrigir encoding.
- Aplicar Supabase lightweight schema.
- Rodar Turso setup.
- Corrigir checkout mock 404.
- Finalizar fluxo de reset de senha.
- Adicionar logout.
- Melhorar CNPJ import com Empresas.
- Testar busca CNPJ em cidade real.
- Adicionar rate limit simples.
- Criar exportação CSV básica.
- Criar README operacional mais completo.

### Médio prazo

- FTS para CNPJ.
- Cache de Overpass.
- Jobs assíncronos.
- Dashboard mais confiável.
- Billing real.
- Templates de mensagem.
- Histórico de contatos.
- Workspaces/equipe.
- Testes unitários e E2E.
- Observabilidade.
- Google Places como fonte opcional paga.
- Upload CSV.

### Longo prazo

- WhatsApp Cloud API oficial.
- CRM completo.
- Automação autorizada de cadências.
- Lead scoring avançado.
- Enriquecimento multi-fonte.
- Marketplace de fontes.
- Multi-tenant enterprise.
- API pública.
- Admin interno.
- Compliance/LGPD avançado.
- Escala nacional de CNPJ com busca dedicada.

## 23. Próximas Features

Compatíveis com a arquitetura atual:

- Exportar leads CSV.
- Importar leads CSV.
- Criar templates de mensagens.
- Histórico de abordagens.
- Marcar lead como “sem interesse”.
- Campo “último contato”.
- Próxima tarefa/follow-up.
- Enriquecimento CNPJ em lote.
- Filtro “tem telefone e não tem site”.
- Ranking de oportunidades.
- Busca por CNAE.
- Upload de lista própria.
- Integração Google Places oficial opcional.
- Checkout real.
- Página de configurações da empresa.
- Logout.
- Reset de senha completo.
- Busca salva.
- Segmentos/listas.
- Webhook real de billing.

## 24. Contexto para outra IA

Use este contexto para continuar o projeto:

```text
Você está trabalhando no PubLeads/LeadCore, um SaaS B2B de prospecção comercial para encontrar empresas locais, salvar leads, gerenciar pipeline, gerar mensagens comerciais com IA e abrir WhatsApp manualmente via wa.me.

Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind, shadcn-like UI, lucide-react, Supabase Auth/Postgres, Turso/libSQL, React Hook Form, Zod, dnd-kit, Recharts.

Arquitetura atual:
- Supabase é usado para auth, profiles, plans, subscriptions e payments.
- Turso é usado para leads, lead_notes, lead_messages, search_logs e cnpj_establishments.
- APIs Next em app/api validam usuário via Supabase auth.getUser() e usam user.id server-side.
- Dados volumosos de prospecção não devem voltar para Supabase.
- Google Maps scraping direto é proibido. Google só por Places API oficial.
- WhatsApp MVP é apenas link wa.me, sem envio automático.

Pastas principais:
- app/: páginas e APIs.
- components/: UI e telas.
- config/: menus, planos, categorias, pipeline.
- schemas/: Zod.
- lib/supabase/: clients Supabase.
- src/lib/turso/: repositories e schema Turso.
- src/lib/lead-sources/: CNPJ, Overpass e Google Places.
- src/lib/ai/: OpenAI/fallback.
- src/lib/whatsapp/: wa.me e providers.
- src/lib/billing/: mock billing.
- src/lib/usage/: limites por plano.
- scripts/: setup/import/migration Turso/CNPJ.
- supabase/: SQL Supabase.

Estado:
- CRUD de leads, pipeline, scraper, CNPJ/OSM/Google oficial, WhatsApp manual, dashboard, analytics e billing mock estão implementados.
- Falta checkout real, WhatsApp Cloud API real, CSV import/export, reset de senha completo, logout, rate limiting e busca CNPJ mais robusta.
- Há bug de encoding em textos PT-BR.
- Billing mock pode redirecionar para /checkout/* inexistente.
- Webhook mock não é adequado para provider real porque exige auth de usuário.
- CNPJ import atual precisa incorporar arquivo Empresas para razão social completa.

Prioridade imediata:
1. Corrigir encoding.
2. Garantir Supabase lightweight schema aplicado.
3. Garantir Turso schema aplicado.
4. Melhorar importação CNPJ.
5. Adicionar logout/reset completo.
6. Adicionar rate limit.
7. Corrigir checkout mock.
8. Implementar exportação CSV.
```

## 25. Manual do Desenvolvedor

### Instalação

```bash
npm install
```

### Variáveis de ambiente

Criar `.env.local` com base em `.env.example`.

Variáveis principais:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000

TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
LEADS_DB_PROVIDER=turso

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

GOOGLE_PLACES_API_KEY=
GOOGLE_MAPS_API_KEY=

CHECKOUT_MENSAL_URL=/checkout/mensal
CHECKOUT_ANUAL_URL=/checkout/anual
CHECKOUT_VITALICIO_URL=/checkout/vitalicio
```

### Rodar localmente

```bash
npm run dev
```

### Configurar Supabase

Usar preferencialmente:

```text
supabase/lightweight-schema.sql
```

Esse SQL deve criar:

- `profiles`
- `plans`
- `subscriptions`
- `payments`
- triggers
- policies
- seed dos planos

Evitar usar `full-setup.sql` como fonte principal em setup novo, pois ele representa a fase anterior com leads no Supabase.

### Configurar Turso

```bash
npm run turso:setup
```

Esse comando aplica:

```text
src/lib/turso/schema.sql
```

### Importar CNPJ

Documentação:

```text
docs/cnpj-import.md
```

Fluxo esperado:

1. Baixar arquivos da Receita.
2. Extrair CSVs.
3. Rodar importador:

```bash
npx tsx scripts/import-cnpj-csv.ts --dir ./cnpj-extraido --uf SP --city "SAO PAULO" --with-phone
```

Para Brasil inteiro, não rodar ingenuamente em ambiente serverless. Fazer localmente ou em worker/servidor dedicado.

### Migrar leads Supabase para Turso

Se houver dados antigos no Supabase:

```bash
npm run turso:migrate
npm run turso:verify
```

Depois, revisar manualmente:

```text
scripts/cleanup-supabase-leads.sql
```

### Validação

```bash
npm run lint
npm run build
npx tsc --noEmit
```

Último estado conhecido: esses comandos já haviam sido estabilizados anteriormente, mas devem ser rodados novamente após qualquer alteração.

### Deploy Vercel

Configurar envs na Vercel:

- Supabase URL/anon/service role.
- Turso URL/token.
- App URL de produção.
- Checkout URLs.
- OpenAI opcional.
- Google Places opcional.

Não subir dados CNPJ para Vercel.

Garantir `.vercelignore` para bases grandes.

### Criar migrations

Para Supabase:

- criar novo arquivo em `supabase/`;
- manter `lightweight-schema.sql` como referência atual;
- nunca misturar novamente leads volumosos no Supabase sem decisão arquitetural explícita.

Para Turso:

- atualizar `src/lib/turso/schema.sql`;
- criar script/migration separada se houver banco já em produção;
- atualizar repositories/mappers/tipos.

### Contribuição

Padrões:

- TypeScript forte.
- Zod em entradas.
- Services/repositories para lógica pesada.
- Componentes visuais sem lógica pesada.
- Config arrays para menus, planos e categorias.
- Loading/empty/error states.
- Toasts de sucesso e erro.
- Não fazer scraping direto do Google Maps.
- Não expor service role no client.
- Não commitar `.env.local`.

## 26. Conclusão

O PubLeads/LeadCore está em estágio de MVP avançado de fundação técnica.

Módulos maduros ou bem estruturados:

- autenticação Supabase;
- layout SaaS;
- CRUD de leads;
- pipeline Kanban;
- Turso para dados volumosos;
- CNPJ como fonte estratégica;
- Overpass como fonte gratuita;
- WhatsApp manual;
- IA com fallback;
- billing mock;
- dashboard e analytics.

Módulos ainda imaturos:

- CNPJ em escala nacional;
- billing real;
- webhook real;
- reset de senha completo;
- exportação/importação;
- rate limiting;
- testes;
- observabilidade;
- configurações;
- checkout;
- WhatsApp oficial.

Decisões arquiteturais que devem ser preservadas:

- Supabase para auth e dados leves de conta/plano.
- Turso para leads e dados volumosos.
- APIs sempre derivando `user.id` da sessão.
- Google somente por API oficial.
- WhatsApp manual por `wa.me` no MVP.
- Fontes de leads plugáveis.
- Validação com Zod.
- UI modular e baseada em componentes.

Convenções a manter:

- Componentes em PascalCase.
- Funções/variáveis em camelCase.
- Rotas em kebab-case.
- Configurações em arrays dentro de `config/`.
- Integrações dentro de `src/lib/`.
- Repositories para acesso ao Turso.
- SQL versionado em `supabase/` e `src/lib/turso/schema.sql`.
- Não colocar lógica pesada dentro de componentes visuais.

O próximo foco técnico deve ser estabilizar o produto para uso real de prospecção: corrigir encoding, completar setup Supabase/Turso, tornar CNPJ confiável, adicionar rate limit, resolver checkout mock e implementar exportação.
