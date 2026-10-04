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

## Pipeline health (self-checks each run)

Every run now protects the live menu and records how it went:

- **30% drop guard.** The out-of-stock sweep (flipping unseen items to sold out)
  is deferred to one gated step after the scrape. If this run saw more than 30%
  fewer products than the last good run, the sweep is **skipped** and the last
  snapshot is kept — a block or feed change can't empty the menu. Only stores
  that returned products this run are ever swept, so a failed store keeps its
  inventory.
- **Match rate + stale stores.** After the run it logs match rate (in-stock rows
  with `clean_brand`, target ≥90%) and any store with no product update in 3+
  days, into the `pipeline_runs.notes` for that run.
- **Alerts.** On a crash, zero changes, most stores failing, the guard tripping,
  or match rate under target, it emails via Resend — if configured. Without the
  Resend vars it still logs the warning and writes the run row; it just doesn't
  email. See the alert block in `.env.example`.

**Test it safely** before trusting a nightly run:

```bash
STORE_LIMIT=3 npm run scrape     # scrapes 3 stores, writes a pipeline_runs row
```

Then check the newest `pipeline_runs` row in Supabase — its `notes` should show
`match …% · … · sweep applied`. To test an alert email, set the Resend vars and
run with `STORE_LIMIT=0` against a blocked network (or temporarily lower the
guard) so it reports zero changes.

## Files

- `scrape.mjs` — the scraper (GraphQL feed capture + Supabase upsert + health).
- `package.json` — Node deps (Playwright).
- `.env.example` — copy to `.env` and add your key (+ optional alert vars).
