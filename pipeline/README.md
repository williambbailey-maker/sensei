# Pipeline — run the scraper on your own computer

**Why local, not the cloud:** Dutchie is behind Cloudflare, which blocks
datacenter IPs (GitHub Actions, any cloud server) but trusts residential IPs
like your home internet. That's why the same code works from your Mac and can't
work from the cloud. The scraper runs on your computer; it writes to the cloud
database (Supabase), which is reachable from anywhere.

## Setup (once)

From this folder:

```bash
npm install
```

That installs Playwright and downloads a Chromium browser automatically.

Then create your `.env` and paste your Supabase **service_role** key
(Supabase dashboard → Project Settings → API → `service_role` — the secret one):

```bash
cp .env.example .env
open -e .env      # paste the key after SUPABASE_SERVICE_ROLE_KEY=, save, close
```

`.env` is git-ignored, so the key stays on your machine.

## Run

```bash
npm run scrape
```

This scrapes **every active store** (from the Supabase `stores` table) across
flower / edibles / pre-rolls / vaporizers / concentrates / tinctures / topicals,
upserts everything into Supabase, marks anything not seen this run as out of
stock, and writes a `pipeline_runs` row. A Chrome window opens — leave it
visible; that's the most reliable way past Cloudflare.

Optional knobs (prefix the command):

- `STORE_LIMIT=3 npm run scrape` — only the first 3 stores (quick test).
- `HEADLESS=1 npm run scrape` — hide the browser window.
- `SLOW=1 npm run scrape` — cautious pacing if a run gets flaky.

Manage which stores are scraped in the Supabase `stores` table (`active` flag),
not in the code.

## Files

- `scrape.mjs` — the scraper (GraphQL feed capture + Supabase upsert).
- `package.json` — Node deps (Playwright).
- `.env.example` — copy to `.env` and add your key.
