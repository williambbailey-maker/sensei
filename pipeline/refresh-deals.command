#!/bin/bash
# Re-pick the deals board from the current sale prices (the scraper already
# does this at the end of every run; use this to re-pick on demand).
#   bash ~/Downloads/sensei-main/pipeline/refresh-deals.command
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

# Same saved key as refresh-inventory.command.
SAVED="$HOME/.config/sensei/pipeline.env"
[ -f .env ] || { [ -f "$SAVED" ] && cp "$SAVED" .env; }
if [ ! -f .env ]; then
  echo "No Supabase key saved yet. Run refresh-inventory.command once first."
  read -n 1 -r -s -p "Press any key to close this window."; echo; exit 1
fi

echo "== Sensei deals refresh =="
npm run --silent deals
echo; read -n 1 -r -s -p "Press any key to close this window."; echo
