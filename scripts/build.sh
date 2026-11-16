#!/usr/bin/env bash
# build.sh [<demo>... | --set <name> | --all]: with no names, builds the whole site into dist/ (what
# the image serves). With names, builds each demo's page on its own, into a temp folder, so one
# broken demo is named instead of failing the whole build. Exits 1 if any fails.
set -uo pipefail
. "$(dirname "$0")/lib.sh"
cd "$ROOT"
if [ $# = 0 ]; then
  pnpm -s build && echo "site build ok: $(ls dist/demos | wc -l | tr -d ' ') demos in dist/demos/"
  exit
fi
list=$(targets "$@") || exit 1
out=$(mktemp -d); trap 'rm -rf "$out"' EXIT
fail=0
for n in $list; do
  if log=$(FEATURE=$n pnpm -s exec vite build --outDir "$out/$n" --emptyOutDir 2>&1); then
    printf '%-22s build ok\n' "$n"
  else
    printf '%-22s build FAIL\n' "$n"; echo "$log" | tail -5 | sed 's/^/    /'; fail=1
  fi
done
exit $fail
