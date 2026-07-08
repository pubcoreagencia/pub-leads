-- LEGACY ONLY. Do not use this file for new setups.
-- PubLeads Supabase full setup
-- Supabase remains responsible for Auth, profiles, plans, subscriptions and payments.
-- Leads, notes, messages and search_logs live in Turso for the current architecture.
-- Run this file in the Supabase SQL Editor for the target project.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.plans (
  id text primary key,
  name text not null,
  type text not null constraint plans_type_check check (
    type in ('free', 'mensal', 'anual', 'vitalicio')
  ),
  price_cents integer not null default 0 constraint plans_price_cents_check check (price_cents >= 0),
  currency text not null default 'BRL',
  billing_interval text not null constraint plans_billing_interval_check check (
    billing_interval in ('none', 'month', 'year', 'lifetime')
  ),
  lead_limit integer,
  search_limit integer,
  whatsapp_instance_limit integer,
  pipeline_limit integer,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  current_plan_id text not null default 'free' references public.plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active' constraint subscriptions_status_check check (
    status in ('active', 'trialing', 'past_due', 'canceled', 'expired')
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  external_provider text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id text references public.plans(id),
  amount_cents integer not null constraint payments_amount_cents_check check (amount_cents >= 0),
  currency text not null default 'BRL',
  status text not null default 'pending' constraint payments_status_check check (
    status in ('pending', 'paid', 'failed', 'refunded', 'canceled')
  ),
  provider text,
  provider_payment_id text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'openstreetmap' constraint leads_source_check check (
    source in ('openstreetmap', 'overpass', 'csv', 'manual', 'google_places', 'cnpj_brasil')
  ),
  external_id text,
  name text not null,
  company text,
  business_name text,
  fantasy_name text,
  cnpj text,
  category text,
  cnae text,
  cnae_description text,
  phone text,
  phone_2 text,
  whatsapp text,
  email text,
  website text,
  address text,
  city text,
  state text,
  country text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  status text not null default 'new' constraint leads_status_check check (
    status in ('new', 'qualified', 'contacted', 'responded', 'proposal', 'won', 'lost')
  ),
  pipeline_stage text not null default 'new' constraint leads_pipeline_stage_check check (
    pipeline_stage in ('new', 'qualified', 'contacted', 'responded', 'proposal', 'won', 'lost')
  ),
  metadata jsonb not null default '{}'::jsonb,
  enrichment_source text,
  enrichment_confidence numeric(4, 2),
  raw_cnpj_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_user_source_external_id_key unique (user_id, source, external_id)
);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'whatsapp_manual' constraint lead_messages_channel_check check (
    channel in ('whatsapp_manual', 'email', 'phone', 'other')
  ),
  direction text not null default 'outbound' constraint lead_messages_direction_check check (
    direction in ('outbound', 'inbound')
  ),
  content text not null,
  wa_me_url text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'openstreetmap' constraint search_logs_source_check check (
    source in ('openstreetmap', 'overpass', 'csv', 'google_places', 'cnpj_brasil')
  ),
  query text not null,
  location text,
  category text,
  result_count integer not null default 0 constraint search_logs_result_count_check check (result_count >= 0),
  status text not null default 'success' constraint search_logs_status_check check (
    status in ('success', 'failed')
  ),
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create index if not exists profiles_current_plan_id_idx on public.profiles(current_plan_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_plan_id_idx on public.subscriptions(plan_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_subscription_id_idx on public.payments(subscription_id);
create index if not exists leads_user_id_idx on public.leads(user_id);
create index if not exists leads_user_status_idx on public.leads(user_id, status);
create index if not exists leads_user_pipeline_stage_idx on public.leads(user_id, pipeline_stage);
create index if not exists leads_user_source_external_id_idx on public.leads(user_id, source, external_id);
create index if not exists leads_user_cnpj_idx on public.leads(user_id, cnpj);
create index if not exists leads_user_phone_idx on public.leads(user_id, phone);
create index if not exists leads_user_phone_2_idx on public.leads(user_id, phone_2);
create index if not exists lead_notes_user_id_idx on public.lead_notes(user_id);
create index if not exists lead_notes_lead_id_idx on public.lead_notes(lead_id);
create index if not exists lead_messages_user_id_idx on public.lead_messages(user_id);
create index if not exists lead_messages_lead_id_idx on public.lead_messages(lead_id);
create index if not exists search_logs_user_id_idx on public.search_logs(user_id);
create index if not exists search_logs_user_created_at_idx on public.search_logs(user_id, created_at);
create index if not exists cnpj_establishments_uf_municipio_idx on public.cnpj_establishments(uf, municipio);
create index if not exists cnpj_establishments_cnae_idx on public.cnpj_establishments(cnae_fiscal);
create index if not exists cnpj_establishments_phone_idx on public.cnpj_establishments(telefone_1, telefone_2);
create index if not exists cnpj_establishments_nome_fantasia_trgm_idx
on public.cnpj_establishments using gin (nome_fantasia gin_trgm_ops);
create index if not exists cnpj_establishments_razao_social_trgm_idx
on public.cnpj_establishments using gin (razao_social gin_trgm_ops);
create index if not exists cnpj_establishments_cnae_desc_trgm_idx
on public.cnpj_establishments using gin (cnae_fiscal_descricao gin_trgm_ops);

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_notes_updated_at on public.lead_notes;
create trigger set_lead_notes_updated_at
before update on public.lead_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_cnpj_establishments_updated_at on public.cnpj_establishments;
create trigger set_cnpj_establishments_updated_at
before update on public.cnpj_establishments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, current_plan_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'free'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_messages enable row level security;
alter table public.search_logs enable row level security;
alter table public.cnpj_establishments enable row level security;

revoke all on public.plans from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.leads from anon, authenticated;
revoke all on public.lead_notes from anon, authenticated;
revoke all on public.lead_messages from anon, authenticated;
revoke all on public.search_logs from anon, authenticated;
revoke all on public.cnpj_establishments from anon, authenticated;

grant select on public.plans to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.payments to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.lead_notes to authenticated;
grant select, insert, update, delete on public.lead_messages to authenticated;
grant select, insert, update, delete on public.search_logs to authenticated;
grant select on public.cnpj_establishments to authenticated;

drop policy if exists "Plans are readable by authenticated users" on public.plans;
create policy "Plans are readable by authenticated users"
on public.plans for select
to authenticated
using (is_active = true);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions"
on public.subscriptions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own payments" on public.payments;
create policy "Users can read own payments"
on public.payments for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can manage own leads" on public.leads;
create policy "Users can manage own leads"
on public.leads for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can manage own lead notes" on public.lead_notes;
create policy "Users can manage own lead notes"
on public.lead_notes for all
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = lead_notes.lead_id
      and leads.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = lead_notes.lead_id
      and leads.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own lead messages" on public.lead_messages;
create policy "Users can manage own lead messages"
on public.lead_messages for all
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = lead_messages.lead_id
      and leads.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = lead_messages.lead_id
      and leads.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own search logs" on public.search_logs;
create policy "Users can manage own search logs"
on public.search_logs for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "CNPJ establishments are readable by authenticated users" on public.cnpj_establishments;
create policy "CNPJ establishments are readable by authenticated users"
on public.cnpj_establishments for select
to authenticated
using (true);

insert into public.plans (
  id,
  name,
  type,
  price_cents,
  currency,
  billing_interval,
  lead_limit,
  search_limit,
  whatsapp_instance_limit,
  pipeline_limit,
  features,
  is_active,
  sort_order
)
values
  (
    'free',
    'Free',
    'free',
    0,
    'BRL',
    'none',
    100,
    5,
    1,
    1,
    '["100 leads", "5 buscas/mes", "WhatsApp manual", "1 pipeline"]'::jsonb,
    true,
    0
  ),
  (
    'mensal',
    'Plano Mensal',
    'mensal',
    14799,
    'BRL',
    'month',
    10000,
    50,
    2,
    3,
    '["10.000 leads/mes", "50 buscas/mes", "2 instancias WhatsApp", "3 pipelines"]'::jsonb,
    true,
    10
  ),
  (
    'anual',
    'Plano Anual',
    'anual',
    49799,
    'BRL',
    'year',
    null,
    null,
    10,
    null,
    '["Leads ilimitados", "Buscas ilimitadas", "10 instancias WhatsApp", "Pipelines ilimitados"]'::jsonb,
    true,
    20
  ),
  (
    'vitalicio',
    'Plano Vitalício',
    'vitalicio',
    99798,
    'BRL',
    'lifetime',
    null,
    null,
    null,
    null,
    '["Tudo liberado para sempre", "Leads ilimitados", "Buscas ilimitadas", "Instancias WhatsApp ilimitadas"]'::jsonb,
    true,
    30
  )
on conflict (id) do update
set
  name = excluded.name,
  type = excluded.type,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  billing_interval = excluded.billing_interval,
  lead_limit = excluded.lead_limit,
  search_limit = excluded.search_limit,
  whatsapp_instance_limit = excluded.whatsapp_instance_limit,
  pipeline_limit = excluded.pipeline_limit,
  features = excluded.features,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.profiles (id, email, full_name, current_plan_id)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
  'free'
from auth.users as users
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  updated_at = now();
