#!/usr/bin/env bash
# build.sh <demo>... | --set <name> | --all: builds each demo into dist/<demo>/ (what its Docker
# image would serve). Exits 1 if any fails. `FEATURE=<demo> pnpm build` builds one into dist/.
set -uo pipefail
. "$(dirname "$0")/lib.sh"
list=$(targets "$@") || exit 1
cd "$ROOT"
fail=0
for n in $list; do
  if log=$(FEATURE=$n pnpm -s exec vite build --outDir "dist/$n" --emptyOutDir 2>&1); then
    printf '%-22s build ok\n' "$n"
  else
    printf '%-22s build FAIL\n' "$n"; echo "$log" | tail -5 | sed 's/^/    /'; fail=1
  fi
done
exit $fail
