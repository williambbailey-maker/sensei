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

# The Supabase key lives in .env next to this file and is never committed (the
# repo is public). It is also saved once to ~/.config/sensei/pipeline.env, so a
# freshly downloaded copy picks it up with no setup. On first run the key comes
# from, in order: that saved file, the .env of an older copy of the code on this
# Mac, or a one-time paste in this window.
SAVED="$HOME/.config/sensei/pipeline.env"
has_key() { [ -f "$1" ] && grep -Eq '^SUPABASE_SERVICE_ROLE_KEY=.{20,}' "$1" && ! grep -q '^SUPABASE_SERVICE_ROLE_KEY=your-service-role-key' "$1"; }

if ! has_key .env; then
  if has_key "$SAVED"; then
    cp "$SAVED" .env
    echo "Using your saved Supabase key."
  else
    OLD=""
    while IFS= read -r f; do
      d="$(dirname "$f")"
      [ "$d" = "$PWD" ] && continue
      if has_key "$d/.env"; then OLD="$d/.env"; break; fi
    done < <({ mdfind -name scrape.mjs 2>/dev/null; find "$HOME/Downloads" "$HOME/Desktop" "$HOME/Documents" "$HOME" -maxdepth 4 -name scrape.mjs -path '*pipeline*' 2>/dev/null; } | awk '!seen[$0]++')
    if [ -n "$OLD" ]; then
      cp "$OLD" .env
      echo "Found your Supabase key in your old copy: $OLD"
    else
      echo "Couldn't find your Supabase key on this Mac."
      echo "Copy the service_role (secret) key from Supabase → Project Settings → API (opening it now),"
      echo "then paste it here and press Return. It won't show on screen as you paste."
      open "https://supabase.com/dashboard/project/dywrisybvcorpfhbwgtg/settings/api"
      read -r -s KEY; echo
      printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$(printf '%s' "$KEY" | tr -d '[:space:]')" > .env
    fi
  fi
fi
if ! has_key .env; then
  echo "That doesn't look like a key. Run this again and paste the service_role key."
  rm -f .env
  pause; exit 1
fi
# Remember it for the next download (readable only by you).
mkdir -p "$(dirname "$SAVED")" && chmod 700 "$(dirname "$SAVED")" && cp .env "$SAVED" && chmod 600 "$SAVED" .env

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
