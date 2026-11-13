#!/usr/bin/env bash
# check.sh [--no-live] <demo>... | --set <name> | --all: the automated pre-deploy checks (1 to 8
# in TEMPLATE.md). Types and unit tests run once for the whole repo (they cover every folder);
# then each demo is built and, unless --no-live, checked live against the API with the key in .env.
# Prints one line per demo and exits 1 if any fails. PASSED_FILE, if set, gets the passing ids.
set -uo pipefail
. "$(dirname "$0")/lib.sh"
live=1; [ "${1:-}" = --no-live ] && { live=0; shift; }
list=$(targets "$@") || exit 1
cd "$ROOT"
ok() { "$@" >/dev/null 2>&1 && echo ok || echo FAIL; }
c=$(ok pnpm check); t=$(ok pnpm test)
echo "repo: check $c  test $t"
fail=0; [ "$c$t" = okok ] || fail=1
for n in $list; do
  b=$(ok env FEATURE="$n" pnpm exec vite build --outDir "dist/$n" --emptyOutDir)
  l=skip; out=
  if [ $live = 1 ]; then
    out=$(ONLY=$n LIVE=1 pnpm exec vitest run tests/live.test.ts 2>&1); l=$([ $? -eq 0 ] && echo ok || echo FAIL)
  fi
  first=$(grep -oE "id: '(flux|nova-3)'" "demos/$n/index.tsx" | head -1 | cut -d"'" -f2)
  printf '%-22s build %-4s live %-4s first model %s\n' "$n" "$b" "$l" "${first:--}"
  if [ "$c$t$b" = okokok ] && [ "$l" != FAIL ]; then
    [ -z "${PASSED_FILE:-}" ] || echo "$n" >>"$PASSED_FILE"
  else
    fail=1
    [ -z "$out" ] || echo "$out" | grep -E "FAIL|opened=false|code=" | head -5 | sed 's/^/    /'
  fi
done
exit $fail
