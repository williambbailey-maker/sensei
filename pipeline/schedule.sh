#!/usr/bin/env bash
# Install a daily macOS auto-run for the scraper (a LaunchAgent).
# Run once from the pipeline folder:   bash schedule.sh
# Change the hour (24h local time):    SCRAPE_HOUR=6 bash schedule.sh
#
# The job runs headless (no visible window) so it works even when the screen is
# locked. If the Mac is asleep at the scheduled time, macOS runs it on next wake.
set -e

NODE="$(command -v node || true)"
[ -z "$NODE" ] && { echo "ERROR: node not found. Install Node first (nodejs.org)."; exit 1; }

DIR="$HOME/sensei/pipeline"
if [ ! -f "$DIR/scrape.mjs" ]; then
  echo "ERROR: expected $DIR/scrape.mjs."
  echo "Clone the repo to ~/sensei first:"
  echo "  git clone https://github.com/williambbailey-maker/sensei.git ~/sensei"
  echo "  cd ~/sensei/pipeline && npm install"
  exit 1
fi

if [ ! -f "$HOME/.sensei/.env" ]; then
  echo "ERROR: ~/.sensei/.env not found — put your SUPABASE_SERVICE_ROLE_KEY there first."
  exit 1
fi

HOUR="${SCRAPE_HOUR:-6}"
PLIST="$HOME/Library/LaunchAgents/com.sensei.scrape.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.sensei"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.sensei.scrape</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/scrape.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HEADLESS</key><string>1</string>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$HOME/.sensei/scrape.log</string>
  <key>StandardErrorPath</key><string>$HOME/.sensei/scrape.log</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PL

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "✅ Scheduled: daily scrape at ${HOUR}:00 (your Mac's local time)."
echo "   Log file:  ~/.sensei/scrape.log"
echo "   Test now:  launchctl start com.sensei.scrape   (then: tail -f ~/.sensei/scrape.log)"
echo "   Disable:   bash unschedule.sh"
echo
echo "Note: the daily run scrapes whatever STORE_LIMIT is set in ~/.sensei/.env."
echo "For the full nightly run, remove the STORE_LIMIT line from ~/.sensei/.env."
