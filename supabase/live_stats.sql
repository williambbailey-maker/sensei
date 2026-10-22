-- One definition of "shop" for every number the site shows, in the app and
-- on the SEO pages. Applied to the Supabase project as the migration
-- `live_shop_counts`; kept here version-controlled.
--
-- A shop is an active store with at least one item in stock. Neighborhoods
-- are those with at least one such shop. Items are in-stock products at those
-- shops. The app reads site_stats() for its home stats and live_stores for
-- its store list; seo/snapshot.sql embeds site_stats() in seo/data/site.json.

create or replace view public.live_stores with (security_invoker = true) as
  select s.* from public.stores s
  where s.active
    and exists (select 1 from public.products p where p.store_id = s.id and p.in_stock);
grant select on public.live_stores to anon, authenticated, service_role;

-- In-stock rows per store, kept small so live_stores and site_stats() count
-- from the index alone (migration `products_in_stock_store_partial_idx`):
-- without it the count read the whole products table and passed the 3s anon
-- timeout once the menu grew past ~60k items.
create index if not exists products_store_in_stock_idx on public.products (store_id) where in_stock;

create or replace function public.site_stats()
returns json
language sql
stable
security invoker
as $$
  with live as (select id, neighborhood from public.live_stores)
  select json_build_object(
    'shops', (select count(*) from live),
    'neighborhoods', (select count(distinct neighborhood) from live where neighborhood is not null),
    'in_stock', (select count(*) from public.products p join live on live.id = p.store_id where p.in_stock)
  );
$$;
grant execute on function public.site_stats() to anon, authenticated, service_role;

-- The out-of-stock sweep (see pipeline_functions.sql) also clears stores that
-- were deactivated: the scraper skips them, so their items would otherwise
-- stay "in stock" forever and inflate every count.
create or replace function public.sweep_out_of_stock(store_ids uuid[], before timestamptz)
returns integer
language sql
set statement_timeout = '120s'
as $$
  with s as (
    update products set in_stock = false
    where in_stock
      and ((store_id = any(store_ids) and last_seen < before)
           or store_id in (select id from stores where not active))
    returning 1
  )
  select count(*)::int from s;
$$;
revoke execute on function public.sweep_out_of_stock(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.sweep_out_of_stock(uuid[], timestamptz) to service_role;

notify pgrst, 'reload schema';
