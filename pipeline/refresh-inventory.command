#!/bin/bash
# Refresh Sensei's inventory: scrapes every active store into Supabase.
# Run it from Terminal (works on any Mac, no security prompt):
#   bash ~/Downloads/sensei-main/pipeline/refresh-inventory.command
# or double-click it in Finder (macOS may ask you to allow it in System
# Settings → Privacy & Security the first time, since it came from a download).
#
# It checks Node, sets up .env (your Supabase service_role key) if missing,
# installs the scraper the first time, keeps the Mac awake during the run, and
# saves a copy of the output to logs/.
cd "$(dirname "$0")" || exit 1

pause() { echo; read -n 1 -r -s -p "Press any key to close this window."; echo; }

echo "== Sensei inventory refresh =="
echo

# Node 22+ (the scraper reads .env with --env-file-if-exists).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed. Install the LTS version from https://nodejs.org,"
  echo "then run this again."
  open "https://nodejs.org"
  pause; exit 1
fi
if ! node --env-file-if-exists=/dev/null -e 0 >/dev/null 2>&1; then
  echo "Your Node.js ($(node -v)) is too old. Install the LTS version from https://nodejs.org,"
  echo "then run this again."
  open "https://nodejs.org"
  pause; exit 1
fi

# The Supabase key lives in .env next to this file (never committed).
if [ ! -f .env ]; then
  cp .env.example .env
  echo "First run: paste your Supabase service_role key into the .env file that just opened,"
  echo "replacing 'your-service-role-key'. Save it (Cmd+S) and close it."
  open -e .env
  echo
  read -r -p "Press Return here when you've saved it... "
fi
if ! grep -Eq '^SUPABASE_SERVICE_ROLE_KEY=.{20,}' .env || grep -q '^SUPABASE_SERVICE_ROLE_KEY=your-service-role-key' .env; then
  echo "The key in .env is missing. Opening it — paste the key after SUPABASE_SERVICE_ROLE_KEY=, save,"
  echo "then run this again."
  open -e .env
  pause; exit 1
fi

# First run only: install the scraper and its browser.
if [ ! -d node_modules/playwright ]; then
  echo "Installing the scraper (first run only, a few minutes)..."
  npm install || { echo; echo "Install failed — send Claude the lines above."; pause; exit 1; }
  echo
fi

mkdir -p logs
LOG="logs/scrape-$(date +%Y%m%d-%H%M%S).log"
echo "Scraping every active store. A Chrome window will open — leave it alone until this finishes."
echo "Output is also saved to pipeline/$LOG"
echo
caffeinate -i npm run scrape 2>&1 | tee "$LOG"
rc=${PIPESTATUS[0]}

echo
if [ "$rc" -eq 0 ]; then
  echo "Done. Tell Claude \"scrape done\" (and paste the last few lines above)."
else
  echo "The scrape stopped with an error (code $rc). Copy the last lines above and send them to Claude."
fi
pause
