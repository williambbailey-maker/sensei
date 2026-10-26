-- Traffic: who visits, when, from where, and what they click.
-- Applied to the Supabase project as the migration `traffic_sessions_report`;
-- kept here version-controlled. Read with analytics/README.md.
--
-- One definition of a visit (a browser tab's session) and of its channel,
-- applied the same way to all history. Earlier rows have fewer fields (see
-- `fields_since` in the report); the classification uses what each row has.

-- The raw link tags, stored as typed so ads and links can be told apart
-- later (the old `source` column keeps only a coarse guess).
alter table public.pageviews
  add column if not exists src text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists click_id boolean not null default false;

-- One row per visit: its first page, its channel, how much it did.
--   channel  meta_ad      a tagged Meta ad click (utm/src), or the old 'ad' guess
--            search       arrived from a search engine
--            social       arrived from a social site without an ad tag
--            tagged_other any other tagged link (QR, newsletter, …)
--            untagged     no tag and no referring site: typed, bookmarked,
--                         an in-app browser that hides the referrer, or a bot
--            internal     a device marked with ?me=1 (excluded from totals)
--   engaged    the visit did anything after landing (any tracked event)
--   suspect    looks automated: untagged, desktop, one page, no referrer,
--              did nothing, and (if located) located at a data centre
create or replace view public.traffic_sessions with (security_invoker = true) as
with pv as (
  select p.*, row_number() over (partition by p.session_id order by p.ts) as rn
  from public.pageviews p where p.session_id is not null
), first as (
  select * from pv where rn = 1
), agg as (
  select session_id, count(*) as pages, bool_or(internal) as any_internal
  from public.pageviews where session_id is not null group by 1
), ev as (
  select session_id,
         count(*) as events,
         count(*) filter (where event = 'menu_click') as menu_clicks,
         count(*) filter (where event = 'directions_click') as directions_clicks,
         count(*) filter (where event = 'order_click') as order_clicks,
         count(*) filter (where event = 'deal_click') as deal_clicks
  from public.events where session_id is not null group by 1
), iv as (
  select * from public.internal_visitors() as v(visitor_id)
)
select
  f.session_id, f.visitor_id, f.ts as started_at,
  (f.ts at time zone 'America/New_York')::date as day_et,
  f.path as landing, f.page_type, f.device, f.referrer, f.source as source_guess,
  f.src, f.utm_source, f.utm_medium, f.utm_campaign, f.utm_content,
  f.country, f.region, f.city, f.tz, f.sw, f.sh,
  a.pages,
  coalesce(e.events, 0) as events,
  coalesce(e.menu_clicks, 0) as menu_clicks,
  coalesce(e.directions_clicks, 0) as directions_clicks,
  coalesce(e.order_clicks, 0) as order_clicks,
  coalesce(e.deal_clicks, 0) as deal_clicks,
  case
    when a.any_internal or f.visitor_id in (select visitor_id from iv) then 'internal'
    when f.src ~* '^(meta|fb|ig|facebook|instagram)'
      or (f.utm_source ~* '^(meta|fb|ig|facebook|instagram)' and coalesce(f.utm_medium, '') ~* '(paid|cpc|ppc|ad)')
      or f.source = 'ad' then 'meta_ad'
    when f.source = 'organic' then 'search'
    when f.source = 'social' then 'social'
    when f.source = 'qr' or f.src is not null or f.utm_source is not null then 'tagged_other'
    else 'untagged'
  end as channel,
  coalesce(e.events, 0) > 0 as engaged,
  case
    when f.region = 'NY' and f.city in ('New York City', 'New York', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'The Bronx',
      'Staten Island', 'Long Island City', 'Astoria', 'Flushing', 'Jamaica') then 'nyc'
    when f.region = 'NY' then 'ny_state'
    when f.country is not null then 'elsewhere'
    else 'unknown'
  end as place_by_connection,
  case
    when f.tz is null then 'unknown'
    when f.tz = 'America/New_York' then 'eastern'
    else 'other'
  end as place_by_timezone,
  (f.source = 'direct' and f.src is null and f.utm_source is null and f.referrer is null
    and coalesce(f.device, '') = 'desktop' and a.pages = 1 and coalesce(e.events, 0) = 0
    and (f.city is null or f.city in ('San Jose', 'Santa Clara', 'Ashburn', 'Boardman', 'Council Bluffs', 'The Dalles',
      'Mountain View', 'Moses Lake', 'Quincy', 'Prineville', 'Forest City', 'Altoona'))) as suspect
from first f
join agg a using (session_id)
left join ev e using (session_id);

-- The report. One JSON object for a date range (inclusive, Eastern time):
-- totals, by channel, by day, location two ways, landing pages, Meta
-- campaigns, and the date each field started being recorded. Internal
-- visits are counted once and excluded from everything else; suspect
-- visits are counted and shown separately, not mixed into channels.
create or replace function public.traffic_report(start_day date, end_day date)
returns json
language sql
stable
set statement_timeout = '60s'
as $$
  with s as (
    select * from public.traffic_sessions where day_et between start_day and end_day
  ), real as (
    select * from s where channel <> 'internal' and not suspect
  )
  select json_build_object(
    'range', json_build_object('start', start_day, 'end', end_day),
    'totals', json_build_object(
      'visits', (select count(*) from real),
      'people', (select count(distinct coalesce(visitor_id, session_id)) from real),
      'pageviews', (select coalesce(sum(pages), 0) from real),
      'engaged_visits', (select count(*) from real where engaged),
      'menu_clicks', (select coalesce(sum(menu_clicks), 0) from real),
      'directions_clicks', (select coalesce(sum(directions_clicks), 0) from real),
      'order_clicks', (select coalesce(sum(order_clicks), 0) from real),
      'deal_clicks', (select coalesce(sum(deal_clicks), 0) from real),
      'excluded_internal', (select count(*) from s where channel = 'internal'),
      'excluded_suspect', (select count(*) from s where channel <> 'internal' and suspect)
    ),
    'by_channel', (select coalesce(json_agg(c order by c.visits desc), '[]'::json) from (
      select channel, count(*) as visits,
             count(distinct coalesce(visitor_id, session_id)) as people,
             count(*) filter (where engaged) as engaged,
             sum(menu_clicks + directions_clicks + order_clicks + deal_clicks) as clicks,
             count(*) filter (where device = 'mobile') as mobile,
             count(*) filter (where place_by_connection = 'nyc') as nyc,
             count(*) filter (where place_by_connection = 'unknown') as place_unknown,
             count(*) filter (where place_by_timezone = 'eastern') as tz_eastern,
             count(*) filter (where place_by_timezone = 'unknown') as tz_unknown
      from real group by 1) c),
    'by_day', (select coalesce(json_agg(d order by d.day), '[]'::json) from (
      select day_et as day, count(*) as visits,
             count(*) filter (where channel = 'meta_ad') as meta_ad,
             count(*) filter (where channel = 'search') as search,
             count(*) filter (where channel = 'social') as social,
             count(*) filter (where channel = 'tagged_other') as tagged_other,
             count(*) filter (where channel = 'untagged') as untagged,
             count(*) filter (where engaged) as engaged
      from real group by 1) d),
    'suspect_by_day', (select coalesce(json_object_agg(day_et, n), '{}'::json) from (
      select day_et, count(*) as n from s where channel <> 'internal' and suspect group by 1 order by 1) x),
    'place_by_connection', (select coalesce(json_object_agg(place_by_connection, n), '{}'::json) from (
      select place_by_connection, count(*) as n from real group by 1) x),
    'place_by_timezone', (select coalesce(json_object_agg(place_by_timezone, n), '{}'::json) from (
      select place_by_timezone, count(*) as n from real group by 1) x),
    'top_cities', (select coalesce(json_agg(x), '[]'::json) from (
      select coalesce(city, '?') as city, coalesce(region, '?') as region, count(*) as visits
      from real where city is not null group by 1, 2 order by 3 desc limit 10) x),
    'landing_pages', (select coalesce(json_agg(x), '[]'::json) from (
      select landing, count(*) as visits, count(*) filter (where engaged) as engaged
      from real group by 1 order by 2 desc limit 10) x),
    'devices', (select coalesce(json_object_agg(coalesce(device, '?'), n), '{}'::json) from (
      select device, count(*) as n from real group by 1) x),
    'meta_campaigns', (select coalesce(json_agg(x), '[]'::json) from (
      select coalesce(utm_campaign, src, '(untagged campaign)') as campaign, coalesce(utm_content, '') as ad,
             count(*) as visits, count(*) filter (where engaged) as engaged,
             sum(menu_clicks + directions_clicks + order_clicks + deal_clicks) as clicks
      from real where channel = 'meta_ad' group by 1, 2 order by 3 desc limit 15) x),
    'fields_since', json_build_object(
      'visits', (select min(ts)::date from public.pageviews),
      'location', (select min(ts)::date from public.pageviews where country is not null),
      'timezone', (select min(ts)::date from public.pageviews where tz is not null),
      'link_tags', (select min(ts)::date from public.pageviews where src is not null or utm_source is not null)
    )
  );
$$;

-- Owner-only: the report is read with the service key (or the dashboard).
revoke all on public.traffic_sessions from anon, authenticated;
revoke execute on function public.traffic_report(date, date) from public, anon, authenticated;
grant select on public.traffic_sessions to service_role;
grant execute on function public.traffic_report(date, date) to service_role;

notify pgrst, 'reload schema';
