-- SEO snapshot: the source for seo/data/site.json.
--
-- Run as one script (service role or the dashboard). It stages in-stock
-- products at live shops in indexed temp tables, then returns one JSON
-- object. Uses the same definitions as the app, via live_stores and
-- site_stats(): a shop is an active store with at least one item in stock.
--
-- Page sets: every live shop gets a dispensary entry; neighborhoods, brands
-- and categories are the lists below (pages exist only where editorial copy
-- exists in seo/data/copy/). Keep these lists in step with the copy files.

drop table if exists _st, _ip, _item;
create temp table _st as select * from public.live_stores;
create temp table _ip as
  select p.id, p.store_id, p.name, p.brand, p.category, p.strain_type, p.thc_pct, p.price_min, p.image_url, p.url,
         s.slug store_slug, s.name store_name, s.neighborhood, s.borough
  from public.products p join _st s on s.id = p.store_id where p.in_stock;
create index on _ip (store_id); create index on _ip (neighborhood); create index on _ip (brand); create index on _ip (category);
create temp table _item as
  select _ip.*, jsonb_build_object('name', name, 'brand', brand, 'category', category, 'strain_type', strain_type,
    'thc_pct', round(thc_pct::numeric, 2), 'price_min', round(price_min::numeric, 2), 'image_url', image_url, 'url', url) j
  from _ip where price_min > 0 and image_url is not null;
create index on _item (store_id); create index on _item (neighborhood); create index on _item (brand); create index on _item (category);
analyze _st; analyze _ip; analyze _item;

with
hoods(neighborhood, ord) as (select * from unnest(array[
  'Astoria','East & West Village','Harlem & Washington Heights','Upper East Side','Coney Island',
  'Gramercy & Union Square','Upper West Side','Jackson Heights','Chelsea & Flatiron','FiDi','Midtown',
  'Bushwick','Chinatown & LES','SoHo','Brooklyn Heights & Downtown','Williamsburg','Sheepshead Bay','Park Slope'
]) with ordinality),
brands(brand, ord) as (select * from unnest(array[
  'ayrloom','Camino','Off Hours','Wyld','MFNY','Ruby Farms','Grön','Eaton Botanicals','Fernway',
  'Dank By Definition.','Jetty Extracts','Jaunty','Florist Farms','Cannabals','Good Tide'
]) with ordinality),
cats(category, ord) as (select * from unnest(array[
  'concentrates','edibles','flower','pre-rolls','tinctures','topicals','vaporizers'
]) with ordinality)
select jsonb_build_object(
 'stats', public.site_stats()::jsonb,
 'last_scrape', (select max(last_seen) from public.products where in_stock),
 'dispensaries', (select jsonb_agg(jsonb_build_object(
    'slug', s.slug, 'name', s.name, 'address', s.address, 'borough', s.borough, 'neighborhood', s.neighborhood,
    'lat', round(s.lat::numeric, 3), 'lng', round(s.lng::numeric, 3),
    'in_stock', (select count(*) from _ip where _ip.store_id = s.id),
    'brands', (select count(distinct brand) from _ip where _ip.store_id = s.id),
    'min_price', (select round(min(price_min)::numeric, 2) from _ip where _ip.store_id = s.id and price_min > 0),
    'categories', (select jsonb_object_agg(category, n) from (select category, count(*) n from _ip where _ip.store_id = s.id and category is not null group by 1) x),
    'top_brands', (select jsonb_agg(jsonb_build_object('brand', brand, 'n', n) order by n desc, brand) from (select brand, count(*) n from _ip where _ip.store_id = s.id and brand is not null group by 1 order by 2 desc, 1 limit 6) x),
    'featured', (select jsonb_agg(j order by price_min, name) from (select * from _item where _item.store_id = s.id order by price_min, name limit 4) x)
   ) order by s.slug) from _st s),
 'neighborhoods', (select jsonb_agg(jsonb_build_object(
    'neighborhood', h.neighborhood,
    'borough', (select borough from _st where _st.neighborhood = h.neighborhood group by 1 order by count(*) desc limit 1),
    'stores', (select count(*) from _st where _st.neighborhood = h.neighborhood),
    'in_stock', (select count(*) from _ip where _ip.neighborhood = h.neighborhood),
    'categories', (select jsonb_object_agg(category, n) from (select category, count(*) n from _ip where _ip.neighborhood = h.neighborhood and category is not null group by 1) x),
    'stores_list', (select jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'address', address, 'in_stock', n) order by n desc, slug) from (select _st.slug, _st.name, _st.address, (select count(*) from _ip where _ip.store_id = _st.id) n from _st where _st.neighborhood = h.neighborhood) x),
    'featured', (select jsonb_agg(j order by lower(brand)) from (select * from (select distinct on (lower(brand)) * from _item where _item.neighborhood = h.neighborhood and brand is not null order by lower(brand), price_min, name) y order by lower(brand) limit 4) x)
   ) order by h.ord) from hoods h),
 'categories', (select jsonb_agg(jsonb_build_object(
    'category', c.category,
    'in_stock', (select count(*) from _ip where _ip.category = c.category),
    'stores', (select count(distinct store_id) from _ip where _ip.category = c.category),
    'brands', (select count(distinct brand) from _ip where _ip.category = c.category),
    'min_price', (select round(min(price_min)::numeric, 2) from _ip where _ip.category = c.category and price_min > 0),
    'top_brands', (select jsonb_agg(jsonb_build_object('brand', brand, 'n', n) order by n desc, brand) from (select brand, count(*) n from _ip where _ip.category = c.category and brand is not null group by 1 order by 2 desc, 1 limit 8) x),
    'neighborhoods', (select jsonb_agg(jsonb_build_object('neighborhood', neighborhood, 'n', n) order by n desc, neighborhood) from (select neighborhood, count(*) n from _ip where _ip.category = c.category and neighborhood is not null group by 1 order by 2 desc, 1 limit 12) x),
    'featured', (select jsonb_agg(j - 'category' order by lower(brand)) from (select * from (select distinct on (lower(brand)) * from _item where _item.category = c.category and brand is not null order by lower(brand), price_min, name) y order by lower(brand) limit 6) x)
   ) order by c.ord) from cats c),
 'brands', (select jsonb_agg(jsonb_build_object(
    'brand', b.brand,
    'stores', (select count(distinct store_id) from _ip where _ip.brand = b.brand),
    'in_stock', (select count(*) from _ip where _ip.brand = b.brand),
    'min_price', (select round(min(price_min)::numeric, 2) from _ip where _ip.brand = b.brand and price_min > 0),
    'avg_price', (select round(avg(price_min)) from _ip where _ip.brand = b.brand and price_min > 0),
    'categories', (select jsonb_object_agg(category, n) from (select category, count(*) n from _ip where _ip.brand = b.brand and category is not null group by 1) x),
    'stores_list', (select jsonb_agg(jsonb_build_object('slug', store_slug, 'name', store_name, 'neighborhood', neighborhood, 'borough', borough, 'n', n, 'min_price', mp) order by n desc, store_slug) from (select store_slug, store_name, neighborhood, borough, count(*) n, round(min(price_min) filter (where price_min > 0)::numeric, 2) mp from _ip where _ip.brand = b.brand group by 1,2,3,4 order by 5 desc, 1 limit 12) x),
    'featured', (select jsonb_agg(j - 'brand' order by price_min, name) from (select * from (select distinct on (name) * from _item where _item.brand = b.brand order by name, price_min) y order by price_min, name limit 6) x)
   ) order by b.ord) from brands b),
 'coords', (select jsonb_object_agg(slug, jsonb_build_array(round(lat::numeric, 4), round(lng::numeric, 4))) from _st where lat is not null)
) as snapshot;
