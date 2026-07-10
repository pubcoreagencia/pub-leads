pragma foreign_keys = on;

create table if not exists leads (
  id text primary key,
  user_id text not null,
  name text not null,
  business_name text,
  fantasy_name text,
  cnpj text,
  category text,
  cnae text,
  cnae_description text,
  phone text,
  phone_2 text,
  whatsapp text,
  phone_type text not null default 'unknown',
  normalized_phone text,
  normalized_whatsapp text,
  whatsapp_status text not null default 'unknown',
  whatsapp_confidence integer,
  whatsapp_validation_source text,
  whatsapp_checked_at text,
  qualification_tags text,
  email text,
  website text,
  address text,
  city text,
  state text,
  country text,
  latitude real,
  longitude real,
  source text,
  source_place_id text,
  source_url text,
  rating real,
  reviews_count integer,
  status text not null default 'new',
  score integer default 0,
  enrichment_source text,
  enrichment_confidence real,
  raw_data text not null default '{}',
  raw_cnpj_data text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists lead_notes (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  user_id text not null,
  note text not null,
  created_at text not null default current_timestamp
);

create table if not exists lead_messages (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  user_id text not null,
  message text not null,
  tone text,
  objective text,
  created_at text not null default current_timestamp
);

create table if not exists search_logs (
  id text primary key,
  user_id text not null,
  query text,
  city text,
  state text,
  country text,
  category text,
  result_count integer not null default 0,
  source text,
  status text not null default 'success',
  raw_params text not null default '{}',
  created_at text not null default current_timestamp
);

create table if not exists apify_runs (
  id text primary key,
  user_id text not null,
  actor_id text not null,
  run_id text not null unique,
  dataset_id text,
  source_type text not null,
  city text,
  niche text,
  status text not null default 'pending',
  requested_limit integer not null default 0,
  results_count integer not null default 0,
  estimated_cost_usd real not null default 0,
  started_at text not null default current_timestamp,
  finished_at text,
  metadata text not null default '{}'
);

create table if not exists cnpj_establishments (
  cnpj text primary key,
  cnpj_basico text,
  cnpj_ordem text,
  cnpj_dv text,
  is_headquarters integer,
  razao_social text,
  nome_fantasia text,
  situacao_cadastral text,
  data_situacao_cadastral text,
  data_inicio_atividade text,
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
  raw_data text not null default '{}',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create index if not exists leads_user_id_idx on leads(user_id);
create index if not exists leads_user_status_idx on leads(user_id, status);
create index if not exists leads_user_city_idx on leads(user_id, city);
create index if not exists leads_user_state_idx on leads(user_id, state);
create index if not exists leads_user_category_idx on leads(user_id, category);
create index if not exists leads_user_source_idx on leads(user_id, source);
create index if not exists leads_user_source_place_id_idx on leads(user_id, source_place_id);
create index if not exists leads_user_cnpj_idx on leads(user_id, cnpj);
create index if not exists leads_user_phone_idx on leads(user_id, phone);
create index if not exists leads_user_created_at_idx on leads(user_id, created_at);
create unique index if not exists leads_user_source_place_unique_idx
  on leads(user_id, source, source_place_id)
  where source_place_id is not null and source_place_id <> '';

create index if not exists lead_notes_user_lead_idx on lead_notes(user_id, lead_id);
create index if not exists lead_messages_user_lead_idx on lead_messages(user_id, lead_id);
create index if not exists search_logs_user_created_at_idx on search_logs(user_id, created_at);
create index if not exists search_logs_user_source_idx on search_logs(user_id, source);
create index if not exists apify_runs_user_started_idx on apify_runs(user_id, started_at);
create index if not exists cnpj_establishments_uf_municipio_idx on cnpj_establishments(uf, municipio);
create index if not exists cnpj_establishments_cnae_idx on cnpj_establishments(cnae_fiscal);
create index if not exists cnpj_establishments_phone_idx on cnpj_establishments(telefone_1, telefone_2);
create index if not exists cnpj_establishments_nome_fantasia_idx on cnpj_establishments(nome_fantasia);
create index if not exists cnpj_establishments_razao_social_idx on cnpj_establishments(razao_social);

create trigger if not exists leads_set_updated_at
after update on leads
for each row
when new.updated_at = old.updated_at
begin
  update leads set updated_at = current_timestamp where id = old.id;
end;

create trigger if not exists cnpj_establishments_set_updated_at
after update on cnpj_establishments
for each row
when new.updated_at = old.updated_at
begin
  update cnpj_establishments set updated_at = current_timestamp where cnpj = old.cnpj;
end;
