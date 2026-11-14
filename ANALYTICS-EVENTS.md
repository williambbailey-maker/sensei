# Analytics — event instrumentation (Block 1)

PostHog instrumentation for the two surfaces. This covers what fires where; the
weekly report (`reports/`) and pipeline-health logging are separate blocks.

Spec: `ANALYTICS.md`. Nine events, each carrying six properties with no
exceptions: `brand`, `product_key`, `dispensary`, `neighborhood`, `page_type`,
`source`.

## Where it lives

| Surface | File | How |
|---|---|---|
| React app (SPA at `/`) | `app/src/lib/analytics.ts` + components | `posthog-js`, bundled |
| Static SEO pages | `seo/build.py` → `analytics_js()` | inline script, baked at build |

`page_type` + `source` are registered as super-properties, so every event
(including the automatic `$pageview`) carries all six fields. The four
per-item fields default to `null` and are set on product/brand events.

`product_key` = `slug(brand + " " + name)` — identical in both surfaces
(`productKey()` in TS, `pkey()` in Python), matching the `clean_brand`/
`clean_name` match definition, so one product has one key everywhere.

`source` ∈ `organic | direct | qr | social | ad`, derived once at load from
UTM / `?src=qr-<batch>` then the referrer. Unplaceable → `direct`.

## Event → surface map

| Event | App | SEO pages | Fires on |
|---|:--:|:--:|---|
| `$pageview` | ✅ | ✅ | page load (auto) |
| `product_impression` | ✅ | ✅ | product card enters viewport (IntersectionObserver, once) |
| `product_view` | ✅ | — | product card tapped → detail opens (app only; SEO has no product page) |
| `brand_view` | — | ✅ | brand page load (`page_type==='brand'`) |
| `compare_view` | — | — | no compare surface yet — wire when one ships |
| `save` | ✅ | — | add-to-cart / save (app only) |
| `chip_tap` | ✅ | ✅ | filter chip (app) / brand·hood·category chip or bar (SEO) |
| `menu_click` | ✅ | ✅ | outbound to Dutchie (app) / "open in Sensei" CTA (SEO) |
| `signup` | ✅ | — | newsletter submit succeeds (app only) |

The SEO pages are the organic landing surface; their exploratory signal is
`brand_view` + `chip_tap` (+ `product_impression`), and `menu_click` is the
click-through into the app.

**Rule (ANALYTICS.md):** any element that shows a brand or product ships with
its `data-*` attributes. On SEO pages those are `data-ev` +
`data-brand`/`data-product-key`/`data-category`/`data-hood`/`data-dispensary`;
in the app they're built from the `Product` in `ProductCard`.

## Switching it on (the key)

The key is a **public** PostHog project key (`phc_…`, write-only, ships in the
bundle). Two placements, same key:

1. **App** — set `VITE_POSTHOG_KEY` (and optional `VITE_POSTHOG_HOST`,
   default `https://us.i.posthog.com`) as a Vercel env var. Rebuild/redeploy.
2. **SEO pages** — export `SENSEI_POSTHOG_KEY` (and optional
   `SENSEI_POSTHOG_HOST`) before `python seo/build.py`, then copy the
   regenerated pages into `app/public/` and deploy.

With no key set, both surfaces are a **safe no-op** — the app runs untouched and
the inline SEO script returns immediately. Nothing tracks until the key is in.

## Verify on a phone (required before "done")

From a real mobile session, confirm in PostHog → Activity that events arrive
with all six properties populated:
- load an SEO dispensary page → `$pageview` with `page_type=dispensary`,
  `dispensary`, `neighborhood`, `source`
- load a brand page → `brand_view`
- scroll product cards → `product_impression` with `brand` + `product_key`
- tap a chip → `chip_tap`; tap the CTA → `menu_click`
- in the app: open a product → `product_view`; add → `save`; subscribe →
  `signup`

## Changed Nov 14 (/start: yes goes to the deals page)

"Yes" on /start now opens `/deals` plus the ad's query string, not the
finder (`/?entry=borough`): in the first two days nobody from the ads got
through the finder to a product. The button reads "See today's deals" and its
`cta_tap` target is `see_deals` (was `pick_neighborhood`). A visitor who
already answered is sent to `/deals` too. The app's pageview is then
`path: "/deals"` with the same tags, visitor and session ids; what to watch
is `deal_open` / `product_view` and the click-out events after it.

## Added Nov 14 (/start tracking)

- `page_seen` (every static page) now also fires on the visitor's first
  touch, key press or scroll, not only after 2 seconds on screen. Its props
  say which: `via: "timer"` or `via: "interaction"`. It still never fires for
  a load that was never on screen: Instagram preloads ad links in the
  background, and those loads have a `$pageview` but no `page_seen`.
- `/start` registers `in_app_browser` (`instagram` / `facebook` / `none`),
  `is_instagram_app`, `visibility_at_load` and `prerendering_at_load` in
  PostHog, so they ride on the `$pageview` and every event. The Supabase
  events rows carry `in_app_browser` in `props`.
- `cta_tap` (`variant: "start"`, `target`): every tap on /start, named by the
  spot tapped (`pick_neighborhood`, `yes_21`, `under_21`, `outside_sheet`,
  `sheet`, `stats`, `headline`, `lede`, `bullets`, `wordmark`, `small_print`,
  `terms`, `privacy`, or `page` for anywhere else). PostHog autocapture stays
  off on purpose (curated events only).
- `age_gate_dismissed` (`variant: "start"`, `how`): the 21+ sheet closed
  without an answer: `outside` (tapped outside it), `escape`, or `left` (the
  page was hidden or closed while it was open). `age_gate_no` was already
  sent on "I'm under 21".

## Changed Nov 12 (the /start ad page: pitch first)

`/start` now opens on the pitch (what Sensei does, the shop, neighborhood
and item counts) with one button, "Pick your neighborhood". Tapping it sends
`start_cta` and then `age_gate_shown` (both `variant: "start"`) and opens the
21+ question in a bottom sheet. So on `/start`, `age_gate_shown` now means
"tapped the button", not "the page loaded". "Yes" opens the finder's first
step, `/?entry=borough` plus the ad's query string, instead of the home. A
visitor who already answered goes straight there too. Before Nov 12 compare
by pageviews, not by `age_gate_shown`.

## Added Nov 3 (the /start ad page)

`/start` is the page paid ads link to: the 21+ question on its own. It
writes a `pageviews` row with `page_type: "start"` and the link's tags, then
`age_gate_shown`, `age_gate_yes` or `age_gate_no` with `variant: "start"`
(the app's sheet sends `variant: "sheet"`). "Yes" stores the app's own 21+
answer and opens the app at `/` with the same query string, so the app's
pageview keeps the attribution and the same visitor and session ids. A
visitor who already answered is sent straight on and nothing is recorded
for `/start`.

## Added Oct 28 (the deals page)

Deals now open the product detail instead of the shop's menu, so a deal tap
is no longer a click out; the click out is the detail's `menu_click` or
`directions_click`. `deal_click` stays for hand-typed deals, which still
link out.

| Event | When | Props |
|---|---|---|
| `deal_open` | a deal row on the `/deals` page (the home board was removed Nov 10, 2026) | product props, `where` (`home` / `deals`), `rank`, `pct` |
| `deals_all` | "See all deals" under the home board (removed Nov 10, 2026; no longer fires) | `where` |
| `deals_filter` | a type tab, the place select or the sort on `/deals` | `type`, `place` or `sort` |

`load_more` on `/deals` carries `where: "deals"`.

## Added Oct 27

| Event | When | Props |
|---|---|---|
| `order_click` | "Order at <shop>" in the cart | `dispensary` (slug), `url`, `items` |
| `deal_click` | a row of the home deals board (removed Nov 10, 2026; no longer fires) | `dispensary` (slug), `brand`, `url`, `pct`, `rank` |

Pageviews now also carry the link's raw tags (`src`, `utm_source`,
`utm_medium`, `utm_campaign`, `utm_content`, `click_id`), and headless or
automated browsers (`navigator.webdriver`, HeadlessChrome) are not recorded.
Reporting: `analytics/README.md`.

## Added Oct 26 (visit steps)

Passive signals: recorded, but not counted as "did something" in reports.

| Event | When | Props |
|---|---|---|
| `age_gate_shown` | the 21+ check appears (first visit on a device) | — |
| `age_gate_yes` | "Yes, I'm 21 or older" | — |
| `age_gate_no` | "I'm under 21" (sent before leaving for Google) | — |
| `scroll_depth` | first pass of 25/50/75/100% of the home's scroll | `view` ("home"), `pct` |
| `time_on_site` | 10, 30, 60 and 180 seconds with the tab on screen | `seconds` |

## Changed Oct 27: the 21+ check is a bottom sheet

In the app the 21+ question is now a sheet pinned to the bottom of the screen,
with the page visible (but inert) behind it. `age_gate_shown`, `age_gate_yes`
and `age_gate_no` from the app carry `variant: "sheet"`; earlier rows (the
full-screen gate) have no `variant`. The static SEO pages keep their own
full-screen gate and don't send these events.
