#!/usr/bin/env bash
# deploy.sh [--dry-run] [--skip-checks] <demo>... | --set <name> | --all
#
# Deploys each demo to its own Fly app, dg-devrel-<demo> (org deepgram), from this one repo:
# the shared fly.toml and Dockerfile, with --build-arg FEATURE=<demo> picking the folder.
# Runs check.sh first and deploys only the demos that pass (--skip-checks skips that).
# Then probes each deployed site. --dry-run prints the fly commands and deploys nothing.
# Never creates apps or secrets: a new demo's app and key are set up by hand once (README).
set -uo pipefail
. "$(dirname "$0")/lib.sh"
dry=0 checks=1 args=()
for a in "$@"; do
  case $a in
    --dry-run) dry=1 ;;
    --skip-checks) checks=0 ;;
    *) args+=("$a") ;;
  esac
done
list=$(targets "${args[@]+"${args[@]}"}") || exit 1
cd "$ROOT"

if [ $checks = 1 ] && [ $dry = 0 ]; then
  PASSED_FILE=$(mktemp); export PASSED_FILE
  bash scripts/check.sh $list
  passed=$(cat "$PASSED_FILE"); rm -f "$PASSED_FILE"
  skipped=$(comm -23 <(echo "$list" | sort) <(echo "$passed" | sort) | tr '\n' ' ')
  [ -z "$skipped" ] || echo "failed checks, not deploying: $skipped"
  list=$passed
fi
[ -n "$list" ] || { echo "nothing to deploy"; exit 1; }

fail=0 done=()
for n in $list; do
  app=dg-devrel-$n
  cmd=(fly deploy . --config fly.toml --app "$app" --build-arg "FEATURE=$n" --remote-only --ha=false)
  if [ $dry = 1 ]; then echo "${cmd[*]}"; continue; fi
  echo "== $app"
  fly secrets list -a "$app" 2>/dev/null | grep -q DEEPGRAM_API_KEY \
    || { echo "$app: no app or no DEEPGRAM_API_KEY secret; set it up first (README, New demo step 6)"; fail=1; continue; }
  if "${cmd[@]}" 2>&1 | tail -2; [ "${PIPESTATUS[0]}" = 0 ]; then done+=("$n"); else echo "$app: deploy FAILED"; fail=1; fi
done
[ $dry = 1 ] && exit 0
[ ${#done[@]} = 0 ] || bash scripts/probe.sh "${done[@]}" || fail=1
exit $fail
