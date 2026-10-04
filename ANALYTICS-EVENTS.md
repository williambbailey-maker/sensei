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
