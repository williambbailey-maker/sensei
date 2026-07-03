# Pipeline — run the scraper on your own computer

**Why local, not the cloud:** Dutchie is behind Cloudflare, which blocks
datacenter IPs (GitHub Actions, any cloud server) but trusts residential IPs
like your home internet. That's why your original script worked on your machine
and a cloud version can't. The scraper therefore runs on your computer; it still
writes to the cloud database (Supabase), which is reachable from anywhere.

## One-time setup

```bash
pip install playwright requests
python -m playwright install chromium
```

## Get your Supabase service-role key

Supabase dashboard → your project → **Project Settings → API** → copy the
**`service_role`** key (the secret one, not `anon`). This lets the script write
products. Keep it private — never commit it.

## Run

```bash
export SUPABASE_SERVICE_ROLE_KEY="paste-the-service-role-key"
# optional (defaults are already set for the current project):
# export SUPABASE_URL="https://<project-ref>.supabase.co"

cd pipeline
python local_scrape.py
```

A Chrome window opens and scrapes each active store (from the Supabase `stores`
table) across edibles / flower / pre-rolls / vaporizers, upserts everything into
Supabase, writes a `pipeline_runs` row, and drops a CSV backup on your Desktop.

- Run headless (no visible window) with `HEADLESS=true` — but a visible browser
  is the most reliable against Cloudflare, so leave it visible if a run gets
  blocked.
- Manage which stores are scraped in the Supabase `stores` table (set `active`),
  not in the code.

## Run it automatically (optional)

- **macOS:** a `launchd` plist or `cron` entry that runs the command daily while
  your Mac is awake.
- **Windows:** Task Scheduler → daily trigger → run `python local_scrape.py`.

The machine has to be on and awake at the scheduled time. (Fully hands-off,
runs-in-the-cloud automation would require a paid residential proxy, which we're
deliberately not doing.)

## Files

- `local_scrape.py` — the scraper (your proven DOM extraction) + Supabase upsert.
- `sync.py` — Supabase read/write helper (used by `local_scrape.py`).
- `requirements.txt` — Python deps.
