-- Sensei revamp — database schema
-- Applied to the Supabase project via the dashboard / MCP. Kept here so the
-- schema is version-controlled and reproducible.
--
-- Tables: stores, products, deals, subscribers, pipeline_runs.
-- RLS: anon (public site, anon key) gets SELECT on stores/products/deals and
-- INSERT-only on subscribers. pipeline_runs is closed to anon. The pipeline uses
-- the service_role key, which bypasses RLS, so it needs no write policies.

create table if not exists public.stores (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  provider    text not null default 'dutchie',
  name        text,
  address     text,
  borough     text,
  lat         double precision,
  lng         double precision,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores(id) on delete cascade,
  external_id      text not null,
  name             text,
  clean_name       text,
  brand            text,
  clean_brand      text,
  category         text,
  strain_type      text,
  thc_pct          numeric,
  cbd_pct          numeric,
  variants         jsonb not null default '[]'::jsonb,
  price_min        numeric,
  url              text,
  image_url        text,
  vibes            text[],
  experience_level text,
  potency_tier     text,
  price_band       text,
  content_hash     text,
  in_stock         boolean not null default true,
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  unique (store_id, external_id)
);

create index if not exists products_store_id_idx on public.products (store_id);
create index if not exists products_in_stock_idx on public.products (in_stock);
create index if not exists products_category_idx on public.products (category);

create table if not exists public.deals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  store_id    uuid references public.stores(id) on delete set null,
  url         text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  featured    boolean not null default false,
  sort        integer not null default 0
);

create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  source     text,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_runs (
  id                    uuid primary key default gen_random_uuid(),
  ran_at                timestamptz not null default now(),
  stores_ok             integer,
  stores_failed         integer,
  products_seen         integer,
  products_tagged       integer,
  tagging_cost_estimate numeric,
  notes                 text
);

-- Row Level Security ---------------------------------------------------------

alter table public.stores        enable row level security;
alter table public.products      enable row level security;
alter table public.deals         enable row level security;
alter table public.subscribers   enable row level security;
alter table public.pipeline_runs enable row level security;

create policy "public read stores"
  on public.stores for select
  to anon, authenticated
  using (true);

create policy "public read products"
  on public.products for select
  to anon, authenticated
  using (true);

create policy "public read deals"
  on public.deals for select
  to anon, authenticated
  using (true);

-- INSERT-only for subscribers: an insert policy but no select policy, so anon
-- can add an email but cannot read the subscriber list back.
create policy "public insert subscribers"
  on public.subscribers for insert
  to anon, authenticated
  with check (true);

-- pipeline_runs: RLS enabled with no policy on purpose — anon has no access;
-- only the service_role key (pipeline) touches it, and that bypasses RLS.

-- Pipeline health in one call for the weekly report (reports/pull.py).
create or replace function public.pipeline_stats(stale_days int default 3)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'in_stock',      (select count(*) from products where in_stock),
    'matched',       (select count(*) from products where in_stock and clean_brand is not null),
    'active_stores', (select count(*) from stores where active),
    'stale_stores',  (select coalesce(json_agg(s.slug order by s.slug), '[]'::json) from stores s
                      where s.active and not exists (select 1 from products p where p.store_id = s.id
                        and p.last_seen >= now() - make_interval(days => stale_days)))
  );
$$;
revoke all on function public.pipeline_stats(int) from public;
grant execute on function public.pipeline_stats(int) to service_role;
