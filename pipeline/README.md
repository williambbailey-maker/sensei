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

## Files

- `scrape.mjs` — the scraper (GraphQL feed capture + Supabase upsert + health).
- `scrape-nightly.sh` — wrapper launchd runs each night (pull, caffeinate, log).
- `com.sensei.scrape.plist` — launchd schedule template (`__REPO__` filled at install).
- `package.json` — Node deps (Playwright).
- `.env.example` — copy to `.env` and add your key (+ optional alert vars).
