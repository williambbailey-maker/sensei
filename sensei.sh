#!/usr/bin/env bash
# Sensei — one self-healing command for everything. No setup, no git needed.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/williambbailey-maker/sensei/main/sensei.sh) scrape
#       (the full inventory refresh — the one line to save)
#   bash <(curl -fsSL https://raw.githubusercontent.com/williambbailey-maker/sensei/main/sensei.sh) discover
#   bash <(curl -fsSL https://raw.githubusercontent.com/williambbailey-maker/sensei/main/sensei.sh) app
#
# Every run: downloads the latest code into ~/sensei (never touching your
# .env key), installs any missing dependencies, then runs the task.
set -e

TASK="${1:-scrape}"
REPO="williambbailey-maker/sensei"
DEST="$HOME/sensei"

command -v node >/dev/null || { echo "ERROR: Node is not installed. Get it from nodejs.org first."; exit 1; }

echo "==> Updating code from GitHub…"
TMP="$(mktemp -d)"
curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.zip" -o "$TMP/sensei.zip"
unzip -q -o "$TMP/sensei.zip" -d "$TMP"
mkdir -p "$DEST"
# Sync code over the existing folder; the key and installed packages survive.
rsync -a --exclude '.env' --exclude 'node_modules' --exclude 'capture' "$TMP/sensei-main/" "$DEST/"
rm -rf "$TMP"

cd "$DEST/pipeline"

# Key check — everything except the app needs the service key. A key saved
# elsewhere on this Mac (the refresh script's save spot, or an older
# downloaded copy) is picked up automatically.
if [ "$TASK" != "app" ]; then
  if [ ! -f .env ]; then
    for f in "$HOME/.config/sensei/pipeline.env" "$HOME"/Downloads/sensei-*/pipeline/.env; do
      if [ -f "$f" ] && grep -Eq '^SUPABASE_SERVICE_ROLE_KEY=.{20,}' "$f"; then cp "$f" .env; echo "==> Using your saved Supabase key."; break; fi
    done
  fi
  if [ ! -f .env ]; then
    cp .env.example .env
    echo
    echo "ERROR: no key yet. A .env file was just created — paste your Supabase"
    echo "service_role key after SUPABASE_SERVICE_ROLE_KEY= , save, close, re-run."
    open -e .env 2>/dev/null || true
    exit 1
  fi
  if grep -q "your-service-role-key" .env; then
    echo
    echo "ERROR: .env still has the placeholder. Paste your real service_role key,"
    echo "save, close, and re-run this same command."
    open -e .env 2>/dev/null || true
    exit 1
  fi
fi

echo "==> Checking dependencies (first run can take a few minutes)…"
npm install --no-audit --no-fund --loglevel=error || {
  echo
  echo "ERROR: dependency install failed — see the npm output above."
  echo "Common fix: check your internet connection and re-run this same command."
  exit 1
}

case "$TASK" in
  scrape)
    echo "==> Scraping all active stores (1–2 hours; leave the Chrome window alone)…"
    mkdir -p logs
    # caffeinate keeps the Mac awake; the log is kept in pipeline/logs/.
    caffeinate -i npm run scrape 2>&1 | tee "logs/scrape-$(date +%Y%m%d-%H%M).log"
    ;;
  discover)
    echo "==> Discovering new Dutchie stores in Manhattan / Brooklyn / Bronx…"
    node discover.mjs
    ;;
  addresses)
    echo "==> Refreshing store addresses only (fast — no menus)…"
    INFO_ONLY=1 npm run scrape
    ;;
  app)
    echo "==> Starting the app locally…"
    cd "$DEST/app"
    npm install --no-audit --no-fund --loglevel=error
    npm run dev -- --open
    ;;
  *)
    echo "Usage: sensei.sh [scrape|addresses|discover|app]"
    exit 1
    ;;
esac
