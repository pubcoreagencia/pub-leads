-- PubLeads Supabase lightweight setup
-- This is the current recommended schema for new setups.
-- Supabase fica responsavel por Auth, profiles, plans, subscriptions e payments.
-- Leads, notas, mensagens e search_logs ficam no Turso.

create extension if not exists "pgcrypto";

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

create index if not exists profiles_current_plan_id_idx on public.profiles(current_plan_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_plan_id_idx on public.subscriptions(plan_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_subscription_id_idx on public.payments(subscription_id);

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

revoke all on public.plans from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.payments from anon, authenticated;

grant select on public.plans to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.payments to authenticated;

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
