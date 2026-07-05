# Pipeline — run the scraper on your own computer

**Why local, not the cloud:** Dutchie is behind Cloudflare, which blocks
datacenter IPs (GitHub Actions, any cloud server) but trusts residential IPs
like your home internet. That's why the same code works from your Mac and can't
work from the cloud. The scraper runs on your computer; it writes to the cloud
database (Supabase), which is reachable from anywhere.

It's written in Node so there's only one toolchain to install (you already have
Node for the app).

## One-time setup

From this `pipeline/` folder:

```bash
npm install
```

That installs Playwright and downloads a Chromium browser automatically. (If the
browser download is skipped for any reason, run `npx playwright install chromium`.)

## Get your Supabase service-role key

Supabase dashboard → your project → **Project Settings → API** → copy the
**`service_role`** key (the secret one, not `anon`). This lets the scraper write
products. Keep it private — never commit it.

## Set the key once — in a permanent place (recommended)

Put your key in `~/.sensei/.env`, a folder that lives **outside the code** so it
survives any code update or re-download and you never re-enter it:

```bash
mkdir -p ~/.sensei
touch ~/.sensei/.env
open -e ~/.sensei/.env
```

Paste these lines, save, close:

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...your service_role key...
# optional while testing: only scrape the first N stores
STORE_LIMIT=2
```

The scraper always reads `~/.sensei/.env` regardless of where the code lives. A
local `.env` in this folder still works too (as a fallback), but the home
location is the durable one.

## Run

```bash
npm run scrape
```

A Chrome window opens and scrapes each active store (from the Supabase `stores`
table) across edibles / flower / pre-rolls / vaporizers, upserts everything into
Supabase, marks anything not seen this run as out of stock, and writes a
`pipeline_runs` row.

Options:

- `HEADLESS=1 npm run scrape` — hide the browser window (a visible browser is the
  most reliable against Cloudflare, so leave it visible if a run gets blocked).
- `STORE_LIMIT=3 npm run scrape` — scrape only the first 3 stores (quick test).

Manage which stores are scraped in the Supabase `stores` table (`active` flag),
not in the code.

## Run it automatically (optional)

- **macOS:** a `launchd` job or `cron` entry that runs `npm run scrape` daily
  while your Mac is awake.
- The machine has to be on and awake at the scheduled time.

## Files

- `scrape.mjs` — the scraper (DOM extraction + Supabase upsert).
- `package.json` — Node deps (Playwright).
