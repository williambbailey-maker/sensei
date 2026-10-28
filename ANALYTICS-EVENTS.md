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

## Added Oct 28 (the deals page)

Deals now open the product detail instead of the shop's menu, so a deal tap
is no longer a click out; the click out is the detail's `menu_click` or
`directions_click`. `deal_click` stays for hand-typed deals, which still
link out.

| Event | When | Props |
|---|---|---|
| `deal_open` | a deal row, on the home board or the `/deals` page | product props, `where` (`home` / `deals`), `rank`, `pct` |
| `deals_all` | "See all deals" under the home board | `where` |
| `deals_filter` | a type tab, the place select or the sort on `/deals` | `type`, `place` or `sort` |

`load_more` on `/deals` carries `where: "deals"`.

## Added Oct 27

| Event | When | Props |
|---|---|---|
| `order_click` | "Order at <shop>" in the cart | `dispensary` (slug), `url`, `items` |
| `deal_click` | a row of the home deals board | `dispensary` (slug), `brand`, `url`, `pct`, `rank` |

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

## Removed Oct 27: no age check

The 21+ check is gone from the app and the static pages. `age_gate_shown`,
`age_gate_yes` and `age_gate_no` no longer fire; rows before this change stay
in `events`. In `traffic_report`'s funnel, `saw_age_check`, `said_21_plus` and
`said_under_21` read 0 for visits after it. The Terms page still states the
site is for adults 21 and over.
