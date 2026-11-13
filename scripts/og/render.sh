#!/usr/bin/env bash
# Renders a feature's 1200x630 share card to demos/<feature>/og.png with headless Chrome,
# from card.html and the brand fonts and art in public/. macOS paths; any Chrome works on Linux
# if you set CHROME.
#
#   pnpm og <feature> "<headline>" "<one line>" "<query string to show>" "<part to mark>" [globe|wave]
#
# Keep the query string real: copy it from the page's Request card.
set -euo pipefail
[ $# -ge 5 ] || { sed -n 2,8p "$0"; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
out="$root/demos/$1/og.png"
[ -d "$(dirname "$out")" ] || { echo "no feature folder demos/$1"; exit 1; }
chrome=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
query=$(python3 -c 'import sys, urllib.parse as u; print(u.urlencode(dict(zip("h p c m art".split(), sys.argv[1:]))))' \
  "$2" "$3" "$4" "$5" "${6:-globe}")
"$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=3000 \
  --screenshot="$out" "file://$here/card.html?$query" 2>/dev/null
echo "wrote ${out#"$root"/}"
