#!/usr/bin/env bash
# Update the Sensei code in place — no git required.
# Run any time you want the latest version:
#   bash ~/sensei/pipeline/update.sh
#
# This re-downloads the code from GitHub and refreshes ~/sensei.
# It NEVER touches ~/.sensei/.env (your keys live outside the code folder),
# and it keeps the already-downloaded browser in node_modules so it's fast.
set -e

REPO="williambbailey-maker/sensei"
DEST="$HOME/sensei"
TMP="$(mktemp -d)"

echo "⬇️  Downloading the latest Sensei code…"
curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.zip" -o "$TMP/sensei.zip"
unzip -q -o "$TMP/sensei.zip" -d "$TMP"

echo "📁 Updating $DEST …"
mkdir -p "$DEST"
# --delete keeps the folder in sync with GitHub; --exclude keeps your installed
# browser/deps so npm install stays quick.
rsync -a --delete --exclude node_modules "$TMP/sensei-main/" "$DEST/"
rm -rf "$TMP"

echo "📦 Refreshing dependencies…"
cd "$DEST/pipeline" && npm install --silent

echo
echo "✅ Updated. Code is at ~/sensei — your keys in ~/.sensei/.env were untouched."
echo "   Run a scrape:  cd ~/sensei/pipeline && npm run scrape"
