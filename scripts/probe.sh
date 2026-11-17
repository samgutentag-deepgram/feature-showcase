#!/usr/bin/env bash
# probe.sh <demo>... | --set <name> | --all: checks the live site, dg-devrel-demos. For each demo:
#   page /demos/<id>/ 200, og.png 200, /api/token?demo=<id> 200 same-origin and 403 cross-site.
# probe.sh --redirects [<demo>...]: checks the old apps. dg-devrel-<id>.fly.dev/x?y=1 must answer
#   301 to https://dg-devrel-demos.fly.dev/demos/<id>/x?y=1. No names: every app in redirect/apps.txt.
# Read-only. Each demo costs 2 token requests against the site's own per-address limit (20 a minute,
# 120 an hour, server.js LIMITS), so it pauses a minute after every 9 demos. A full run takes about
# 4 minutes and uses 76 of the hourly 120: run it once an hour at most, or name the demos.
set -uo pipefail
. "$(dirname "$0")/lib.sh"
fail=0
if [ "${1:-}" = --redirects ]; then
  shift
  if [ $# = 0 ]; then list=$(redirect_apps); else list=$(targets "$@") || exit 1; fi
  for name in $list; do
    got=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://dg-devrel-$name.fly.dev/x?y=1")
    want="301 $SITE_URL/demos/$name/x?y=1"
    r=$([ "$got" = "$want" ] && echo ok || echo FAIL); [ "$r" = ok ] || fail=1
    printf '%-22s %s  %s\n' "$name" "$got" "$r"
  done
  exit $fail
fi
list=$(targets "$@") || exit 1
n=0
for name in $list; do
  if [ $n -gt 0 ] && [ $((n % 9)) = 0 ]; then echo '(pausing 61s for the per-address token limit)'; sleep 61; fi
  n=$((n + 1))
  u=$SITE_URL/demos/$name/
  p=$(curl -s -o /dev/null -w '%{http_code}' "$u")
  o=$(curl -s -o /dev/null -w '%{http_code}' "${u}og.png")
  s=$(curl -s -o /dev/null -w '%{http_code}' -H "origin: $SITE_URL" -H 'sec-fetch-site: same-origin' "$SITE_URL/api/token?demo=$name")
  x=$(curl -s -o /dev/null -w '%{http_code}' -H 'origin: https://example.com' -H 'sec-fetch-site: cross-site' "$SITE_URL/api/token?demo=$name")
  r=$([ "$p$o$s$x" = 200200200403 ] && echo ok || echo FAIL)
  [ "$r" = ok ] || fail=1
  printf '%-22s page %s  og %s  token same-origin %s  cross-site %s  %s\n' "$name" "$p" "$o" "$s" "$x" "$r"
done
exit $fail
