-- Deterministic product normalization (Block 2.5).
-- Populates clean_brand, clean_name, potency_tier, price_band, experience_level.
-- Incremental by default (only rows missing each field); full_refresh => all.
-- Called by the nightly scraper (pipeline/scrape.mjs) after each run, and by
-- `npm run normalize`. Applied to the Supabase project as a migration; kept here
-- version-controlled.
--
-- A later enhancement can add a Haiku pass for true brand canonicalization
-- (merging variants, fixing acronym styling) and vibe tagging — this version is
-- deterministic and needs no API key.

create or replace function public.normalize_products(full_refresh boolean default false)
returns void
language plpgsql
as $$
begin
  -- clean_brand: collapse whitespace, strip trailing dots/spaces, and only
  -- title-case entirely-lowercase names (preserve accents, acronyms, styling).
  update products p
  set clean_brand = nullif(case when x.s = lower(x.s) then initcap(x.s) else x.s end, '')
  from (
    select id, regexp_replace(regexp_replace(trim(brand), '\s+', ' ', 'g'), '[.\s]+$', '') as s
    from products where brand is not null
  ) x
  where p.id = x.id and (full_refresh or p.clean_brand is null);

  -- clean_name: light tidy (heavier display cleanup still happens in the app).
  update products
  set clean_name = nullif(trim(regexp_replace(name, '\s+', ' ', 'g')), '')
  where name is not null and (full_refresh or clean_name is null);

  -- potency_tier: category-aware THC thresholds.
  update products set potency_tier = case
    when category in ('flower','pre-rolls') then
      case when thc_pct < 18 then 'mild' when thc_pct < 26 then 'medium' else 'strong' end
    when category in ('vaporizers','concentrates') then
      case when thc_pct < 70 then 'mild' when thc_pct < 85 then 'medium' else 'strong' end
  end
  where category in ('flower','pre-rolls','vaporizers','concentrates')
    and thc_pct is not null and thc_pct > 0
    and (full_refresh or potency_tier is null);

  -- price_band: per-category terciles of price_min (value / mid / premium).
  update products p set price_band = case
    when p.price_min <= b.p33 then 'value'
    when p.price_min <= b.p67 then 'mid'
    else 'premium' end
  from (
    select category,
      percentile_cont(0.33) within group (order by price_min) as p33,
      percentile_cont(0.67) within group (order by price_min) as p67
    from products where price_min > 0 group by category
  ) b
  where b.category = p.category and p.price_min > 0
    and (full_refresh or p.price_band is null);

  -- experience_level: derived from potency_tier.
  update products set experience_level = case potency_tier
    when 'mild' then 'beginner' when 'medium' then 'intermediate' when 'strong' then 'experienced' end
  where potency_tier is not null and (full_refresh or experience_level is null);
end;
$$;
