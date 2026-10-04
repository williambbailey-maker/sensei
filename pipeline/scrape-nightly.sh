#!/bin/bash
# Nightly Sensei scrape — run by launchd (see com.sensei.scrape.plist).
#
# Pulls the latest code, keeps the Mac awake during the run, scrapes every
# active store, and logs to pipeline/logs/. The Block 2 guard + alerts mean a
# blocked/failed run is safe: it skips the destructive sweep and (if Resend is
# configured) emails you, instead of emptying the live menu.
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"   # the pipeline/ directory
cd "$DIR" || exit 1

# launchd starts with a minimal PATH — add the usual node locations + nvm.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

mkdir -p logs
LOG="logs/scrape-$(date +%Y%m%d-%H%M%S).log"

{
  echo "=== scrape start $(date) ==="
  # Pull the latest pipeline code; ignore failures (offline is fine).
  git -C "$DIR/.." pull --quiet || echo "(git pull skipped/failed)"

  # caffeinate -i blocks idle sleep for the duration of the scrape so a long
  # run isn't cut off. To hide the browser window, prefix HEADLESS=1 below —
  # but a visible browser is more reliable past Cloudflare, so it's the default.
  caffeinate -i npm run scrape
  echo "=== scrape end $(date) rc=$? ==="
} >>"$LOG" 2>&1

# Keep only the 30 most recent run logs.
ls -1t logs/scrape-*.log 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
