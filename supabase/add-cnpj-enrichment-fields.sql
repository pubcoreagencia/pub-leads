-- LEGACY ONLY. Prefer supabase/lightweight-schema.sql for new setups.
-- PubLeads CNPJ enrichment setup for older deployments that still use the legacy Supabase schema.
-- Run after supabase/full-setup.sql on existing projects only.

create extension if not exists "pg_trgm";

alter table public.leads
  add column if not exists cnpj text,
  add column if not exists business_name text,
  add column if not exists fantasy_name text,
  add column if not exists cnae text,
  add column if not exists cnae_description text,
  add column if not exists phone_2 text,
  add column if not exists enrichment_source text,
  add column if not exists enrichment_confidence numeric(4, 2),
  add column if not exists raw_cnpj_data jsonb;

alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check
check (source in ('openstreetmap', 'overpass', 'csv', 'manual', 'google_places', 'cnpj_brasil'));

alter table public.search_logs drop constraint if exists search_logs_source_check;
alter table public.search_logs add constraint search_logs_source_check
check (source in ('openstreetmap', 'overpass', 'csv', 'google_places', 'cnpj_brasil'));

create table if not exists public.cnpj_establishments (
  cnpj text primary key,
  cnpj_basico text,
  cnpj_ordem text,
  cnpj_dv text,
  is_headquarters boolean,
  razao_social text,
  nome_fantasia text,
  situacao_cadastral text,
  data_situacao_cadastral date,
  data_inicio_atividade date,
  cnae_fiscal text,
  cnae_fiscal_descricao text,
  tipo_logradouro text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cep text,
  uf text not null,
  municipio text not null,
  ddd_1 text,
  telefone_1 text,
  ddd_2 text,
  telefone_2 text,
  email text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_user_cnpj_idx on public.leads(user_id, cnpj);
create index if not exists leads_user_phone_idx on public.leads(user_id, phone);
create index if not exists leads_user_phone_2_idx on public.leads(user_id, phone_2);
create index if not exists cnpj_establishments_uf_municipio_idx on public.cnpj_establishments(uf, municipio);
create index if not exists cnpj_establishments_cnae_idx on public.cnpj_establishments(cnae_fiscal);
create index if not exists cnpj_establishments_phone_idx on public.cnpj_establishments(telefone_1, telefone_2);
create index if not exists cnpj_establishments_nome_fantasia_trgm_idx
on public.cnpj_establishments using gin (nome_fantasia gin_trgm_ops);
create index if not exists cnpj_establishments_razao_social_trgm_idx
on public.cnpj_establishments using gin (razao_social gin_trgm_ops);
create index if not exists cnpj_establishments_cnae_desc_trgm_idx
on public.cnpj_establishments using gin (cnae_fiscal_descricao gin_trgm_ops);

drop trigger if exists set_cnpj_establishments_updated_at on public.cnpj_establishments;
create trigger set_cnpj_establishments_updated_at
before update on public.cnpj_establishments
for each row execute function public.set_updated_at();

alter table public.cnpj_establishments enable row level security;

revoke all on public.cnpj_establishments from anon, authenticated;
grant select on public.cnpj_establishments to authenticated;

drop policy if exists "CNPJ establishments are readable by authenticated users" on public.cnpj_establishments;
create policy "CNPJ establishments are readable by authenticated users"
on public.cnpj_establishments for select
to authenticated
using (true);
