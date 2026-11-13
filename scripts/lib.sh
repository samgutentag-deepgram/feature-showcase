# Sourced by the scripts in this folder. ROOT is the repo; every demo is a folder under demos/.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

all_demos() { ls "$ROOT/demos"; }

# Reads a set file: one demo id per line, # comments and blank lines ignored.
read_set() {
  local f=$ROOT/sets/$1.txt
  [ -f "$f" ] || { echo "no set '$1' (sets/: $(cd "$ROOT/sets" && ls | sed 's/\.txt$//' | tr '\n' ' '))" >&2; return 1; }
  sed -e 's/#.*//' -e 's/[[:space:]]//g' "$f" | grep -v '^$'
}

# targets [--all] [--set <name>]... [demo]...: prints the demo ids asked for, once each, in order.
# Fails on a name with no folder, so a typo never deploys nothing quietly.
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
