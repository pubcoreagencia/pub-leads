-- PubLeads billing provider fields
-- Safe additive migration for Banco Inter as billing provider and Utmify as tracking provider.
-- Supabase remains responsible for auth, profiles, plans, subscriptions and payments.
-- Do not move operational lead/scraping data into Supabase.

alter table public.payments
  add column if not exists provider_charge_id text,
  add column if not exists provider_txid text,
  add column if not exists provider_status text,
  add column if not exists checkout_url text,
  add column if not exists pix_copy_paste text,
  add column if not exists pix_qr_code text,
  add column if not exists boleto_url text,
  add column if not exists boleto_barcode text,
  add column if not exists expires_at timestamptz,
  add column if not exists tracking_provider text,
  add column if not exists tracking_status text,
  add column if not exists tracking_event_id text,
  add column if not exists tracking_sent_at timestamptz,
  add column if not exists tracking_error text;

alter table public.subscriptions
  add column if not exists provider text,
  add column if not exists provider_subscription_id text,
  add column if not exists cancel_at_period_end boolean not null default false;

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete cascade,
  provider text not null,
  event_type text not null,
  external_event_id text,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_provider_payment_id_idx on public.payments(provider, provider_payment_id);
create index if not exists payments_provider_txid_idx on public.payments(provider, provider_txid);
create index if not exists payment_events_payment_id_idx on public.payment_events(payment_id);
create index if not exists payment_events_external_event_id_idx on public.payment_events(provider, external_event_id);

drop trigger if exists set_payment_events_updated_at on public.payment_events;
create trigger set_payment_events_updated_at
before update on public.payment_events
for each row execute function public.set_updated_at();

alter table public.payment_events enable row level security;

revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;

drop policy if exists "Users can read own payment events" on public.payment_events;
create policy "Users can read own payment events"
on public.payment_events for select
to authenticated
using (
  exists (
    select 1
    from public.payments
    where payments.id = payment_events.payment_id
      and payments.user_id = auth.uid()
  )
);
