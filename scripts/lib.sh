# Sourced by the scripts in this folder. ROOT is the repo; every demo is a folder under demos/.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

all_demos() { (cd "$ROOT/demos" && for d in */; do [ -f "$d/index.tsx" ] && echo "${d%/}"; done); }

# A demo's kind, read from its index.tsx: tts, agent, llm, or stt (no kind line).
kind_of() {
  local f=$ROOT/demos/$1/index.tsx
  if grep -q "kind: 'tts'" "$f"; then echo tts
  elif grep -q "kind: 'agent'" "$f"; then echo agent
  elif grep -q "kind: 'llm'" "$f"; then echo llm
  else echo stt; fi
}

# Reads a set. stt, tts, and agent are every demo of that kind, worked out from the folders, so a
# new demo needs no list edit. Any other name is sets/<name>.txt: one id per line, # comments and
# blank lines ignored, for hand-picked groups.
read_set() {
  case $1 in
    stt|tts|agent|llm) local n; for n in $(all_demos); do [ "$(kind_of "$n")" = "$1" ] && echo "$n"; done; return 0 ;;
  esac
  local f=$ROOT/sets/$1.txt
  [ -f "$f" ] || { echo "no set '$1' (stt tts agent llm $(cd "$ROOT/sets" && ls | sed 's/\.txt$//' | tr '\n' ' '))" >&2; return 1; }
  sed -e 's/#.*//' -e 's/[[:space:]]//g' "$f" | grep -v '^$'
}

# targets [--all] [--set <name>]... [demo]...: prints the demo ids asked for, once each, in order.
# Fails on a name with no folder, so a typo never checks nothing quietly.
targets() {
  local out=() bad=0
  while [ $# -gt 0 ]; do
    case $1 in
      --all) out+=($(all_demos)) ;;
      --set) shift; local s; s=$(read_set "$1") || return 1; out+=($s) ;;
      --set=*) local s; s=$(read_set "${1#--set=}") || return 1; out+=($s) ;;
      -*) echo "unknown option $1" >&2; return 1 ;;
      *) out+=("$1") ;;
    esac
    shift
  done
  [ ${#out[@]} -gt 0 ] || { echo "name a demo, --set <name>, or --all" >&2; return 1; }
  for n in "${out[@]}"; do
    [ -d "$ROOT/demos/$n" ] || { echo "no demo '$n' (no demos/$n)" >&2; bad=1; }
  done
  [ $bad = 0 ] || return 1
  printf '%s\n' "${out[@]}" | awk '!seen[$0]++'
}

# The one site, and the old per-demo apps that now redirect to it.
SITE_APP=dg-devrel-demos
SITE_URL=https://$SITE_APP.fly.dev
redirect_apps() { sed -e 's/#.*//' -e 's/[[:space:]]//g' "$ROOT/redirect/apps.txt" | grep -v '^$'; }
