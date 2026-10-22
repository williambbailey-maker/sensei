# Pipeline — run the scraper on your own computer

**Why local, not the cloud:** Dutchie is behind Cloudflare, which blocks
datacenter IPs (GitHub Actions, any cloud server) but trusts residential IPs
like your home internet. That's why the same code works from your Mac and can't
work from the cloud. The scraper runs on your computer; it writes to the cloud
database (Supabase), which is reachable from anywhere.

## Quick start (one command)

```bash
bash ~/Downloads/sensei-main/pipeline/refresh-inventory.command
```

`refresh-inventory.command` does everything below for you: checks Node, finds
your Supabase key (a key saved in `~/.config/sensei/pipeline.env`, else the
`.env` of an older copy of this folder, else a one-time paste in Terminal) and
saves it there for the next download, runs `npm install` once, keeps the Mac
awake, scrapes every active store, and saves the output to `logs/`. The key is
never put in the repo, which is public. Adjust
the path if the folder lives somewhere else (you can also double-click the file
in Finder).

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
not in the code. Each store's `provider` column picks the menu platform module
that scrapes it (see **Menu platforms** below).

## Dry run (try one store, write nothing)

```bash
DRY_RUN=1 STORE=conbud-les npm run scrape
```

Scrapes that one store and prints what it *would* save: how many products,
which fields are filled (and which the platform doesn't provide, left empty),
how the list compares with what's live in Supabase, and a few sample products.
The full list is saved to `logs/dry-run-<slug>-….json`. Nothing is written to
Supabase: no products, no store details, no `pipeline_runs` row, no sweep, no
alerts. It doesn't need the service key.

To try a store that isn't in the `stores` table yet, name its platform:

```bash
DRY_RUN=1 STORE=maison-canal PROVIDER=dutchie npm run scrape
```

`DRY_RUN_SHOW=10` prints more sample products (default 3).

## Pipeline health (self-checks each run)

Every run now protects the live menu and records how it went:

- **30% drop guard.** The out-of-stock sweep (flipping unseen items to sold out)
  is deferred to one gated step after the scrape. If this run saw more than 30%
  fewer products than the last good run, the sweep is **skipped** and the last
  snapshot is kept — a block or feed change can't empty the menu. Only stores
  that returned products this run are ever swept, so a failed store keeps its
  inventory.
- **The guard ignores test runs.** It compares against the last run that wasn't
  a `STORE=`/`STORE_LIMIT=` test (those are marked `test run` in the notes) and
  covered at least half as many stores, so a one-store test can't switch it off.
- **Empty stores count as failed.** A store that returns no products is logged
  `EMPTY` and counted in `stores_failed` (its inventory is kept, as before).
  The notes show the split per platform, e.g. `dutchie 68 ok/45 empty/0 failed`.
- **The run is recorded before the heavy steps.** The `pipeline_runs` row is
  written right after the scrape and finished at the end, so a run that dies
  during the sweep or normalize still leaves its counts (and a `CRASHED` note).
- **Polite pacing.** Stores run one at a time with a random 3–6 second pause
  between them.
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

Then check the newest `pipeline_runs` row in Supabase — its `notes` start with
`local node scrape · test run (STORE_LIMIT=3)` and end with the sweep result
(a 3-store test is far below a full run, so the guard skips the sweep). To test an alert email, set the Resend vars and
run with `STORE_LIMIT=0` against a blocked network (or temporarily lower the
guard) so it reports zero changes.

## Normalization (clean brands, tiers)

Dutchie's raw brand/name strings are messy (`STIIIZY`, `Dank By Definition.`,
casing/punctuation variants). After each scrape, the pipeline runs a
**deterministic normalization** that fills `clean_brand`, `clean_name`,
`potency_tier`, `price_band`, and `experience_level`. The app reads the clean
fields (falling back to raw), and the weekly report's brand attribution depends
on `clean_brand`.

- The logic lives in a database function (`supabase/normalize_products.sql`),
  so there's nothing to reimplement — `scrape.mjs` calls it automatically at the
  end of every run (only touches products missing a field, so it's fast).
- Re-run it by hand any time:

  ```bash
  npm run normalize           # incremental — only rows missing a field
  FULL=1 npm run normalize     # full refresh — re-normalize everything
  ```

This pass is deterministic and needs no API key. A future enhancement can add a
Haiku pass for true brand canonicalization (merging variants) and vibe tagging.

## Automate it (nightly, on your Mac)

Dutchie's Cloudflare blocks cloud IPs, so the scrape has to run from your Mac.
`launchd` (macOS's built-in scheduler) runs it each night. Your Mac just needs
to be **on** — if it's asleep at the scheduled time, the job runs once when it
next wakes.

**Install (once), from the repo root:**

```bash
# 1. make the wrapper executable
chmod +x pipeline/scrape-nightly.sh

# 2. test it runs end-to-end first (watch the browser, check the log)
bash pipeline/scrape-nightly.sh && tail -n 20 pipeline/logs/scrape-*.log

# 3. install the schedule (fills in your repo path automatically)
sed "s#__REPO__#$PWD#g" pipeline/com.sensei.scrape.plist > ~/Library/LaunchAgents/com.sensei.scrape.plist

# 4. load it
launchctl load ~/Library/LaunchAgents/com.sensei.scrape.plist

# 5. (optional) run it right now to confirm the schedule works
launchctl start com.sensei.scrape
tail -f pipeline/logs/scrape-*.log     # Ctrl-C to stop watching
```

Runs at **3:30am local**. To change the time, edit `Hour`/`Minute` in
`~/Library/LaunchAgents/com.sensei.scrape.plist`, then
`launchctl unload …` and `launchctl load …` it again.

- **Hide the browser:** set `HEADLESS=1` in `scrape-nightly.sh` (less reliable
  past Cloudflare — a visible window is the default for that reason).
- **Stop automation:** `launchctl unload ~/Library/LaunchAgents/com.sensei.scrape.plist`
- **Logs:** `pipeline/logs/` (git-ignored; last 30 runs kept).
- **Wake the Mac to run even when asleep** (optional):
  `sudo pmset repeat wakeorpoweron MTWRFSU 03:25:00`

## Menu platforms

`scrape.mjs` is the runner; each menu platform is a small module in
`providers/`, picked by the store's `provider` column. A module returns
products already in the `products` row shape, using the shared helpers in
`lib/product.mjs`, and lists in `fields` which columns its platform can fill.
Anything a platform doesn't provide is left empty, never guessed.

- `providers/dutchie.mjs` — Dutchie (the only platform switched on today).
- A store whose platform has no module yet, or whose module has
  `enabled: false`, is skipped and noted, not counted as failed. Dry runs try
  disabled modules, so a new platform is tested on one store before it's on.
- Platform details a store needs (a venue or shop id, its menu URL) go in
  `stores.config.json`, keyed by slug. Dutchie stores need none.

## Files

- `scrape.mjs` — the runner (store list, upsert, sweep, guard, health, alerts).
- `providers/` — one module per menu platform; `providers/index.mjs` lists them.
- `lib/product.mjs` — shared product cleanup (categories, potency, descriptions).
- `stores.config.json` — per-store platform details for non-Dutchie menus.
- `scrape-nightly.sh` — wrapper launchd runs each night (pull, caffeinate, log).
- `com.sensei.scrape.plist` — launchd schedule template (`__REPO__` filled at install).
- `package.json` — Node deps (Playwright).
- `.env.example` — copy to `.env` and add your key (+ optional alert vars).
