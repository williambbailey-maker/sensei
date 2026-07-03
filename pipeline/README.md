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

## Set the key once (recommended)

```bash
cp .env.example .env
```

Then open `.env` and paste your `service_role` key after `SUPABASE_SERVICE_ROLE_KEY=`.
`.env` is git-ignored, so the key stays on your machine. Now every run picks it up
automatically — no need to `export` it each time.

(Alternatively, a one-off: `export SUPABASE_SERVICE_ROLE_KEY="the-key"` in the
current Terminal window.)

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
