-- Pipeline helpers called by the scraper (pipeline/scrape.mjs) with the
-- service_role key. Applied to the Supabase project as the migration
-- `pipeline_sweep_and_timeouts`; kept here version-controlled.
--
-- Why these exist: every request through the REST API is cut off after 8
-- seconds. After a few missed nights thousands of products sell out at once,
-- and the old PATCH-based sweep timed out ("57014 canceling statement due to
-- statement timeout") and crashed the run. Functions can carry their own
-- timeout, so the heavy steps live here.

-- Out-of-stock sweep: flips products in the given stores that were not seen
-- since `before` to in_stock = false. Returns how many rows it flipped.
create or replace function public.sweep_out_of_stock(store_ids uuid[], before timestamptz)
returns integer
language sql
set statement_timeout = '120s'
as $$
  with s as (
    update products set in_stock = false
    where store_id = any(store_ids) and in_stock and last_seen < before
    returning 1
  )
  select count(*)::int from s;
$$;

-- Stores with no product seen in the last `days` days (the stale-store check),
-- computed in the database so it isn't capped by the API's 1000-row limit.
create or replace function public.stale_store_slugs(days integer default 3)
returns setof text
language sql
stable
set statement_timeout = '60s'
as $$
  select s.slug from stores s
  where s.active
    and not exists (
      select 1 from products p
      where p.store_id = s.id and p.last_seen >= now() - make_interval(days => days)
    )
  order by s.slug;
$$;

-- normalize_products (supabase/normalize_products.sql) rewrites large parts of
-- the table; give it the same room.
alter function public.normalize_products(boolean) set statement_timeout = '120s';

-- Pipeline-only: the scraper calls these with the service key. Nobody else may.
revoke execute on function public.sweep_out_of_stock(uuid[], timestamptz) from public, anon, authenticated;
revoke execute on function public.stale_store_slugs(integer) from public, anon, authenticated;
revoke execute on function public.normalize_products(boolean) from public, anon, authenticated;
grant execute on function public.sweep_out_of_stock(uuid[], timestamptz) to service_role;
grant execute on function public.stale_store_slugs(integer) to service_role;
grant execute on function public.normalize_products(boolean) to service_role;

notify pgrst, 'reload schema';
