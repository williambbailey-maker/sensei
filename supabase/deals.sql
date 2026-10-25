-- Sale prices and the deals board. Applied to the Supabase project as the
-- migration `sale_prices_and_deals`; kept here version-controlled.
--
-- Every menu platform sends a regular price next to a sale price. The scraper
-- (pipeline/providers/*) keeps both: each variant carries `was` when it is
-- discounted, and the row gets the cheapest size's regular price in price_was
-- plus on_sale. refresh_deals() then picks the board from those rows after
-- every scrape (pipeline/scrape.mjs) or on demand (pipeline/deals.mjs).

alter table public.products
  add column if not exists price_was numeric,
  add column if not exists on_sale boolean not null default false;

-- The "On sale" filter and the deals pick read only these rows.
create index if not exists products_on_sale_idx on public.products (store_id) where in_stock and on_sale;

-- A deal is either hand-typed (kind = 'manual') or a product the pick chose
-- (kind = 'sale', tied to its product row). price/price_was/pct are the
-- numbers at pick time; live_deals (below) reads the current ones.
alter table public.deals
  add column if not exists product_id uuid references public.products(id) on delete cascade,
  add column if not exists kind text not null default 'manual',
  add column if not exists price numeric,
  add column if not exists price_was numeric,
  add column if not exists pct integer,
  add column if not exists image_url text,
  add column if not exists updated_at timestamptz not null default now();

-- The four sample deals typed in while the board was being built.
delete from public.deals
  where kind = 'manual'
    and title in ('20% Off All Flower', 'Buy 2 Pre-Rolls, Get 1 Free', 'First-Time Customer: $10 Off $50', 'Edibles Happy Hour 4-6pm');

-- Pick the board: in-stock items at live shops whose cheapest size is marked
-- down 20–75% (less is not worth a row; more is almost always a feed error),
-- priced $5 or more, with a photo. One item per shop, then round-robin across
-- product types so the board is not twelve eighths of flower, best discount
-- first. The top four are featured. Replaces the previous pick; hand-typed
-- deals are left alone. Returns how many rows it wrote.
create or replace function public.refresh_deals(n integer default 12)
returns integer
language plpgsql
set statement_timeout = '60s'
as $$
declare
  k integer;
begin
  delete from public.deals where kind = 'sale';
  with cand as (
    select p.id, p.store_id, p.price_min, p.price_was, p.image_url, p.url, p.category,
           coalesce(p.clean_brand, p.brand) as brand,
           coalesce(p.clean_name, p.name) as nm,
           round((1 - p.price_min / p.price_was) * 100)::int as pct,
           p.price_was - p.price_min as saved
    from public.products p
    join public.live_stores s on s.id = p.store_id
    where p.in_stock and p.on_sale
      and p.price_was > p.price_min and p.price_min >= 5
      and p.image_url is not null
      and p.category in ('flower', 'pre-rolls', 'vaporizers', 'edibles', 'concentrates', 'tinctures', 'topicals')
  ), good as (
    select * from cand where pct between 20 and 75
  ), per_store as (
    select distinct on (store_id) * from good order by store_id, pct desc, saved desc
  ), spread as (
    select *, row_number() over (partition by category order by pct desc, saved desc) as rc
    from per_store
  ), pick as (
    select *, row_number() over (order by rc, pct desc, saved desc) as rank
    from spread
    order by rc, pct desc, saved desc
    limit n
  )
  insert into public.deals (title, description, store_id, url, featured, sort, product_id, kind, price, price_was, pct, image_url)
  select nm, brand, store_id, url, rank <= 4, rank, id, 'sale', price_min, price_was, pct, image_url
  from pick;
  get diagnostics k = row_count;
  return k;
end
$$;

-- What the site shows: every hand-typed deal, and every picked one whose
-- product is still in stock and still marked down, at today's prices. The
-- shop comes along as plain columns (no embedding through a view).
create or replace view public.live_deals with (security_invoker = true) as
  select d.id, d.title, d.description, d.url, d.featured, d.sort, d.kind, d.product_id,
         coalesce(p.image_url, d.image_url) as image_url,
         coalesce(p.price_min, d.price) as price,
         coalesce(p.price_was, d.price_was) as price_was,
         case when p.id is not null then round((1 - p.price_min / p.price_was) * 100)::int else d.pct end as pct,
         s.name as store_name, s.borough as store_borough, s.slug as store_slug
  from public.deals d
  left join public.products p on p.id = d.product_id
  left join public.stores s on s.id = d.store_id
  where d.kind <> 'sale' or (p.in_stock and p.on_sale and p.price_was > p.price_min);
grant select on public.live_deals to anon, authenticated, service_role;

-- Pipeline-only: the scraper calls this with the service key.
revoke execute on function public.refresh_deals(integer) from public, anon, authenticated;
grant execute on function public.refresh_deals(integer) to service_role;

notify pgrst, 'reload schema';
