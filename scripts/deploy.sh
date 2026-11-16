#!/usr/bin/env bash
# deploy.sh site [--dry-run] [--skip-checks] [--no-live]
#   Deploys the one site, dg-devrel-demos, with every demo at /demos/<id>/. Runs check.sh --all
#   first and deploys only if every demo passes (--no-live skips the live API checks, --skip-checks
#   skips them all). Then probes every page.
#
# deploy.sh redirects [--dry-run] [<demo>... | --set <name> | --all]
#   Deploys the redirect image (redirect/) to the old per-demo apps, dg-devrel-<id>, so each sends a
#   301 to https://dg-devrel-demos.fly.dev/demos/<id>/ with the path and query kept. With no names,
#   every app in redirect/apps.txt; --all means the same list. Then probes each redirect.
#
# --dry-run prints the fly commands and deploys nothing. Never creates apps or sets secrets (README).
set -uo pipefail
. "$(dirname "$0")/lib.sh"
mode=${1:-}; shift || true
dry=0 checks=1 live=1 args=()
for a in "$@"; do
  case $a in
    --dry-run) dry=1 ;;
    --skip-checks) checks=0 ;;
    --no-live) live=0 ;;
    *) args+=("$a") ;;
  esac
done
cd "$ROOT"
run() { if [ $dry = 1 ]; then echo "$*"; else "$@"; fi; }

case $mode in
  site)
    [ ${#args[@]} = 0 ] || { echo "deploy.sh site takes no demo names: the site always ships every demo" >&2; exit 1; }
    if [ $checks = 1 ] && [ $dry = 0 ]; then
      if [ $live = 1 ]; then bash scripts/check.sh --all; else bash scripts/check.sh --no-live --all; fi \
        || { echo "checks failed: not deploying (fix the demo, or --skip-checks)"; exit 1; }
    fi
    if [ $dry = 0 ]; then
      fly secrets list -a "$SITE_APP" 2>/dev/null | grep -q DEEPGRAM_API_KEY \
        || { echo "$SITE_APP: no app or no DEEPGRAM_API_KEY secret; set it up first (README, Deploy)"; exit 1; }
    fi
    run fly deploy . --config fly.toml --app "$SITE_APP" --remote-only --ha=false || { echo "$SITE_APP: deploy FAILED"; exit 1; }
    [ $dry = 1 ] || bash scripts/probe.sh --all
    ;;
  redirects)
    if [ ${#args[@]} = 0 ] || [ "${args[*]}" = --all ]; then list=$(redirect_apps)
    else
      list=$(targets "${args[@]}") || exit 1
      for n in $list; do redirect_apps | grep -qx "$n" || { echo "$n never had its own app (not in redirect/apps.txt)" >&2; exit 1; }; done
    fi
    fail=0 done=()
    for n in $list; do
      app=dg-devrel-$n
      if [ $dry = 1 ]; then echo "(cd redirect && fly deploy . --config fly.toml --app $app --remote-only --ha=false)"; continue; fi
      echo "== $app"
      if (cd redirect && fly deploy . --config fly.toml --app "$app" --remote-only --ha=false 2>&1 | tail -2; exit "${PIPESTATUS[0]}"); then
        done+=("$n")
      else echo "$app: deploy FAILED"; fail=1; fi
    done
    [ $dry = 1 ] && exit 0
    [ ${#done[@]} = 0 ] || bash scripts/probe.sh --redirects "${done[@]}" || fail=1
    exit $fail
    ;;
  *)
    echo "usage: deploy.sh site [--dry-run] [--skip-checks] [--no-live]" >&2
    echo "       deploy.sh redirects [--dry-run] [<demo>... | --set <name> | --all]" >&2
    exit 1
    ;;
esac
