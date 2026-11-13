#!/usr/bin/env bash
# new.sh <demo> [stt|tts|agent]: starts a new demo folder at demos/<demo>/ from the smallest
# example of its kind (smart-format, telephone-audio, barge-in), writes a README stub, points meta.json at
# https://dg-devrel-<demo>.fly.dev, drops the copied prompt.md, and adds <demo> to sets/<kind>.txt.
# The og.png is the example's card until you render a new one (pnpm og). Edit index.tsx next.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
name=${1:?usage: new.sh <demo> [stt|tts|agent]}
kind=${2:-stt}
case $kind in
  stt) from=smart-format ;;
  tts) from=telephone-audio ;;
  agent) from=barge-in ;;
  *) echo "kind is stt, tts, or agent" >&2; exit 1 ;;
esac
[[ $name =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "demo id is lowercase words joined by '-'" >&2; exit 1; }
dst=$ROOT/demos/$name
[ ! -e "$dst" ] || { echo "$dst exists" >&2; exit 1; }
rsync -a --exclude prompt.md --exclude make-sample.sh --exclude "*.test.ts" "$ROOT/demos/$from/" "$dst/"
python3 - "$dst/meta.json" "$name" <<'PY'
import json, sys
p, name = sys.argv[1], sys.argv[2]
m = json.load(open(p))
m['title'] = f"{name.replace('-', ' ').capitalize()} | Deepgram"
m['description'] = 'TODO: one sentence on what the visitor does and sees.'
m['url'] = f'https://dg-devrel-{name}.fly.dev'
open(p, 'w').write(json.dumps(m, indent=2) + '\n')
PY
cat >"$dst/README.md" <<MD
# $name

**TODO headline.** TODO one paragraph: what the visitor does and what they see change.

- **Live:** https://dg-devrel-$name.fly.dev

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

\`\`\`bash
FEATURE=$name pnpm dev
\`\`\`

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
MD
echo "$name" >>"$ROOT/sets/$kind.txt"
echo "demos/$name/ from $from; added to sets/$kind.txt"
echo "next: edit index.tsx and meta.json, then FEATURE=$name pnpm dev"
