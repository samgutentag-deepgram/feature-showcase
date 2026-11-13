#!/usr/bin/env bash
# probe.sh <demo>... | --set <name> | --all: checks the live site. Page 200, /api/token 200 from the
# app's own origin, 403 from another site. Read-only; safe to run any time.
set -uo pipefail
. "$(dirname "$0")/lib.sh"
list=$(targets "$@") || exit 1
fail=0
for name in $list; do
  u=https://dg-devrel-$name.fly.dev
  p=$(curl -s -o /dev/null -w '%{http_code}' "$u/")
  s=$(curl -s -o /dev/null -w '%{http_code}' -H "origin: $u" -H 'sec-fetch-site: same-origin' "$u/api/token")
  x=$(curl -s -o /dev/null -w '%{http_code}' -H 'origin: https://example.com' -H 'sec-fetch-site: cross-site' "$u/api/token")
  r=$([ "$p$s$x" = 200200403 ] && echo ok || echo FAIL)
  [ "$r" = ok ] || fail=1
  printf '%-22s page %s  token same-origin %s  cross-site %s  %s\n' "$name" "$p" "$s" "$x" "$r"
done
exit $fail
