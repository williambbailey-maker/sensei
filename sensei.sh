#!/usr/bin/env bash
# Sensei — one self-healing command for everything. No setup, no git needed.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/williambbailey-maker/sensei/main/sensei.sh) scrape
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

# Key check — everything except the app needs the service key.
if [ "$TASK" != "app" ]; then
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

echo "==> Checking dependencies (fast when already installed)…"
npm install --no-audit --no-fund --silent

case "$TASK" in
  scrape)
    echo "==> Scraping all active stores…"
    npm run scrape
    ;;
  discover)
    echo "==> Discovering new Dutchie stores in Manhattan / Brooklyn / Bronx…"
    node discover.mjs
    ;;
  app)
    echo "==> Starting the app locally…"
    cd "$DEST/app"
    npm install --no-audit --no-fund --silent
    npm run dev -- --open
    ;;
  *)
    echo "Usage: sensei.sh [scrape|discover|app]"
    exit 1
    ;;
esac
