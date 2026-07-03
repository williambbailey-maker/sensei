# Sensei Revamp — Build Spec

Rebuild of sensei.nyc: replace Squarespace site + Typebot chatbot with a zero-hosting-cost
PWA and an automated daily data pipeline. Built and operated entirely from iPhone via
Claude Code cloud sessions → GitHub → Vercel auto-deploy.

## Goals

1. $0/month hosting (Vercel free + Supabase free + GitHub Actions free)
2. PWA that also works as a normal website (installable, but not required)
3. Daily automated product data refresh — no manual Google Sheet conforming
4. AI does the data cleanup/tagging upstream; runtime filtering is free and instant
5. Landing UX: one text input ("what do you want?") OR a quick tap-through journey → recommendations
6. Carry over: Sparks & Recs (deals) and newsletter signup
7. Store list is data, not code — expanding beyond Dutchie means adding rows, not scripts

## Repo structure (monorepo)

```
sensei/
├── app/                    # React + Vite + TypeScript + Tailwind PWA
├── pipeline/               # Python scraper + tagger
│   ├── adapters/
│   │   ├── dutchie.py
│   │   └── jane.py         # phase 2
│   ├── tagger.py           # Claude API enrichment
│   ├── sync.py             # upsert to Supabase
│   └── main.py
├── .github/workflows/
│   ├── m0-connectivity.yml # Milestone 0 test (manual trigger)
│   └── daily-scrape.yml    # cron pipeline
└── README.md
```

Repo visibility note: public repo = unlimited free Actions minutes; private = 2,000/month.
The JSON-based scraper should finish in well under 30 min/day, so private is fine,
but keep an eye on the minutes meter. No secrets in code ever — all keys in GitHub
Actions secrets and Vercel env vars.

## Milestone 0 — HARD GATE: can GitHub Actions reach Dutchie?

Dutchie has aggressive bot protection. Before building anything else, prove the runner
isn't blocked. Build `m0-connectivity.yml` (workflow_dispatch trigger):

1. Plain `requests` GET on `https://dutchie.com/dispensary/conbud-les/products/flower`
   with realistic browser headers. Check response for embedded product JSON
   (look for `__NEXT_DATA__` script tag or Apollo state) vs. a challenge/block page.
2. If blocked → retry with Playwright headless Chromium (`playwright install chromium`)
   + realistic UA. Dump first 2KB of HTML to the job log either way.
3. Report clearly in job summary: METHOD_THAT_WORKED = requests | playwright | BLOCKED.

Outcomes:
- `requests` works → best case, pipeline is fast and simple
- only `playwright` works → fine, slightly slower jobs
- both blocked → STOP. Options to discuss with William: rotating residential proxy
  (~$5–10/mo, e.g. via a proxy env secret), or a different runner. Do not build the
  full pipeline on an unverified foundation.

## Pipeline design

### Scraping (adapters/dutchie.py)

- DO NOT scrape rendered DOM text with regex (the old approach). Dutchie is Next.js:
  fetch the page and parse the embedded JSON state (`__NEXT_DATA__` / Apollo cache),
  which contains complete structured product records — name, brand, strain type,
  THC/CBD, category, and ALL price/weight variants per product.
- One request per store per category page; respect pagination via the JSON payload
  (it includes total counts). 2–4s randomized delay between requests. Randomize store
  order. Fail soft per-store: one broken store must not kill the run.
- Normalize into a common product dict shape shared by all adapters:
  `{store_slug, provider, external_id, name, brand, category, strain_type,
    thc_pct, cbd_pct, variants: [{weight, price}], url, image_url, raw}`

### Store registry (Supabase `stores` table, not hardcoded lists)

Seed with the ~49 slugs from the existing scripts (lists below). Pipeline reads
active stores from Supabase at run start.

Seed slugs, provider=dutchie, all active:
buzzy-ny, gram-cannabis-dispensary, flowery, high-of-brooklyn,
dagmar-cannabis-williamsburg, citiva-medical-llc-brooklyn, verdi-park-slope,
cbj-retail, hybrid-nyc, conbud-les, dazed-cannabis1, stoop, culture-house,
ny-canna-co-5th-ave, qube-manhattan, torches-nyc, the-emerald-dispensary-manhattan,
temeka-bleecker, gotham-nyc-3rd-st, organic-relief-leaf, the-flowery-east-village,
the-doe-store, sky-high-club, green-genius-nyc, verdi, gotham-chelsea, smiley-exotics,
baiked, blazinup, afny, twenty-one-thirty, gotham-buds, elevate-soho,
smelly-nelly-queens, bloomlee-iii, robin-hood-cannabis-west-broadway, the-daily-green,
healthy-choice, terp-bros-astoria, rnr-dispensary, tango-hotel-charlie-ventures,
weedkraft, pryzm, gmdss-llc, hii, green-jungle, dominica62, sweet-life-nyc
(dedupe `stoop` — it appears in both old lists)

Phase 2: `jane` adapter (I Heart Jane menus expose an Algolia-backed JSON API —
straightforward). Discovery source for new stores: NY OCM licensed adult-use
dispensary list.

### AI tagging (tagger.py) — the step that replaces the Google Sheet

- Compute a content hash per product (name+brand+category+potency). Only send NEW or
  CHANGED products to Claude — deltas keep daily API cost at pennies.
- Model: claude-haiku (cheapest adequate). Batch 25–50 products per request.
- Prompt: return STRICT JSON array only. Per product:
  - `vibes`: 1–3 of [relax, sleep, social, creative, focus, energize, body-high, balance]
  - `experience_level`: beginner | casual | experienced (infer from potency + format)
  - `potency_tier`: mild | medium | strong (category-relative: mg for edibles, % for flower/vapes)
  - `price_band`: $ | $$ | $$$ (category-relative)
  - `clean_name`, `clean_brand` (fix casing/junk)
- Validate JSON, retry once on parse failure, skip batch on second failure (log it).

### Sync (sync.py)

- Upsert products keyed on (store_slug, external_id). Mark products not seen in
  latest run as `in_stock = false` (don't delete — history is future data-licensing value).
- Write a `pipeline_runs` row per run: timestamp, stores_ok, stores_failed,
  products_seen, products_tagged, tagging_cost_estimate.

### Workflow (daily-scrape.yml)

- cron: `0 10 * * *` (6am ET) + workflow_dispatch for manual runs
- Steps: checkout → setup python → pip install → run main.py
- Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
- On failure: the run summary must say which store/step failed (William checks from phone)

## Supabase schema

```sql
stores(id, slug unique, provider, name, address, borough, lat, lng, active bool, created_at)
products(id, store_id fk, external_id, name, clean_name, brand, clean_brand, category,
         strain_type, thc_pct, cbd_pct, variants jsonb, price_min, url, image_url,
         vibes text[], experience_level, potency_tier, price_band,
         content_hash, in_stock bool, first_seen, last_seen)
deals(id, title, description, store_id fk nullable, url, starts_at, ends_at, featured bool, sort)
subscribers(id, email unique, source, created_at)
pipeline_runs(id, ran_at, stores_ok, stores_failed, products_seen, products_tagged, notes)
```

RLS: anon key gets SELECT on stores/products/deals and INSERT-only on subscribers
(no select). Service role key (pipeline only, GitHub secret) does writes.
Use the existing Supabase account; new project or reuse — William's call
(free tier allows 2 projects).

## Frontend (app/)

Stack: React + Vite + TypeScript + Tailwind. PWA via vite-plugin-pwa (manifest +
icons + offline shell). Must be fully usable as a plain website.

**KNOWN PITFALL: do not import lucide-react — it has caused blank-screen failures in
this exact stack before. Use a single inline-SVG `Ico` component for all icons.**

### Screens

1. **Home / hero** — the entire pitch above the fold, no navigation step before value:
   - Wordmark, one line of copy
   - Big single text input: placeholder like "something mellow for a movie night…"
   - Directly below: "or browse by vibe →" starting the tap journey
2. **Tap journey** — 3 quick steps, big tappable cards, no typing:
   vibe → format (flower / pre-roll / edible / vape) → budget. Skippable steps.
3. **Results** — ranked product cards: image, clean_name, brand, store name +
   neighborhood, potency tier badge, price, "view at store" link (the Dutchie URL —
   this is the future affiliate hook). Filters editable inline (chips).
4. **Sparks & Recs** — deals list from `deals` table, featured first.
5. **Newsletter** — email input → insert into `subscribers`. Inline on home footer
   and after results ("get the weekly drop").

### Text input → filters (no runtime AI)

Client-side parser, deterministic:
- keyword/synonym map → vibes (e.g. "chill/mellow/couch" → relax; "party" → social;
  "can't sleep/insomnia" → sleep; "first time/newbie" → experience_level beginner)
- "$40", "under 50", "cheap" → price ceiling / band
- format words ("gummies" → edibles, "joint/pre roll" → pre-rolls, "cart/pen" → vaporizers)
- strain words (indica/sativa/hybrid) → strain_type
- Unmatched input → fall back to full-text match on name/brand + show the tap journey
  chips pre-filled with whatever DID parse.
Ranking: filter match → in_stock → potency/price fit → variety across stores.

### Design direction

Modern, minimal, fast. Dark-leaning palette, generous type, one accent color.
No cannabis-cliché green-leaf aesthetic. Age gate (21+) as a lightweight one-time
interstitial (localStorage flag) — required for cannabis sites.

## Deployment

- Vercel project from repo, root = `app/`, auto-deploy on push to main
- Custom domain sensei.nyc: Network Solutions DNS → A @ 76.76.21.21,
  CNAME www → cname.vercel-dns.com
- Env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

## Build order

1. Milestone 0 connectivity test — GATE, nothing proceeds until it passes
2. Supabase schema + seed stores
3. Dutchie adapter + sync (no tagging yet) — verify a full run in Actions
4. Tagger + delta logic
5. Frontend: home + results + text parser
6. Tap journey, Sparks & Recs, newsletter, age gate, PWA manifest
7. DNS cutover, cancel Squarespace site plan
8. Phase 2: Jane adapter, OCM-based store discovery

## Costs

Vercel $0 · Supabase $0 · GitHub Actions $0 · Claude API ~pennies/day (delta tagging)
· domain renewal (existing) · proxy only if Milestone 0 forces it (~$5–10/mo)
