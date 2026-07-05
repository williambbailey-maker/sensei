#!/usr/bin/env bash
# Remove the daily auto-run.  Run:  bash unschedule.sh
PLIST="$HOME/Library/LaunchAgents/com.sensei.scrape.plist"
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Daily scrape disabled (LaunchAgent removed)."
