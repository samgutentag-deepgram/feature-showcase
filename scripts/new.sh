#!/usr/bin/env bash
# new.sh <demo> [stt|tts|agent|llm|think]: starts a new demo folder at demos/<demo>/ from the smallest
# example of its kind (smart-format, telephone-audio, barge-in), or for the LLM kind from a starter in
# shared/llm-starters/ (llm: Audio and Text Intelligence; think: /v1/think), writes a README stub, points meta.json at
# https://dg-devrel-demos.fly.dev/demos/<demo>/, and drops the copied prompt.md. It also adds the
# demo's tile to index/demos.json (after the last demo of its product, headline and param TODO) and
# sets built:true on its card in index/coming-soon.json if it has one. --set <kind> finds the
# folder by its index.tsx.
# The og.png is the example's card until you render a new one (pnpm og). Edit index.tsx next.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
name=${1:?usage: new.sh <demo> [stt|tts|agent|llm|think]}
kind=${2:-stt}
case $kind in
  stt) from=smart-format ;;
  tts) from=telephone-audio ;;
  agent) from=barge-in ;;
  # LLM kind: no demo to copy yet, so a starter index.tsx plus smart-format's meta.json and og.png.
  llm) from=shared/llm-starters/intelligence.tsx ;;
  think) from=shared/llm-starters/think.tsx ;;
  *) echo "kind is stt, tts, agent, llm, or think" >&2; exit 1 ;;
esac
[[ $name =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "demo id is lowercase words joined by '-'" >&2; exit 1; }
dst=$ROOT/demos/$name
[ ! -e "$dst" ] || { echo "$dst exists" >&2; exit 1; }
if [[ $from == shared/* ]]; then
  mkdir -p "$dst"
  cp "$ROOT/$from" "$dst/index.tsx"
  cp "$ROOT/demos/smart-format/meta.json" "$ROOT/demos/smart-format/og.png" "$dst/"
else
  rsync -a --exclude prompt.md --exclude make-sample.sh --exclude "*.test.ts" "$ROOT/demos/$from/" "$dst/"
fi
python3 - "$dst/meta.json" "$name" <<'PY'
import json, sys
p, name = sys.argv[1], sys.argv[2]
m = json.load(open(p))
m['title'] = f"{name.replace('-', ' ').capitalize()} | Deepgram"
m['description'] = 'TODO: one sentence on what the visitor does and sees.'
m['url'] = f'https://dg-devrel-demos.fly.dev/demos/{name}/'
open(p, 'w').write(json.dumps(m, indent=2) + '\n')
PY
python3 - "$ROOT/index" "$name" "$kind" <<'PY'
import json, sys
index, name, kind = sys.argv[1:]
platform, flux = {'stt': ('Speech-to-text', 'works'), 'tts': ('Text-to-speech', 'tts'), 'agent': ('Voice agent', 'agent'), 'llm': ('LLM', 'intelligence'), 'think': ('LLM', 'think')}[kind]
p = f'{index}/demos.json'
d = json.load(open(p))
added = not any(e['id'] == name for e in d['demos'])
if added:
    at = max((i + 1 for i, e in enumerate(d['demos']) if e['platform'] == platform), default=len(d['demos']))
    d['demos'].insert(at, {'id': name, 'platform': platform, 'headline': 'TODO headline', 'param': 'TODO param', 'flux': flux})
    open(p, 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
p = f'{index}/coming-soon.json'
s = json.load(open(p))
hit = [f for f in s['features'] if f['id'] == name]
for f in hit:
    f['built'] = True
if hit:
    open(p, 'w').write(json.dumps(s, indent=2, ensure_ascii=False) + '\n')
print(f"index/demos.json: {'added' if added else 'already has'} {name}" + (", coming-soon card set to built" if hit else "; no coming-soon card has this id, so flip its card by hand if it has another"))
PY
cat >"$dst/README.md" <<MD
# $name

**TODO headline.** TODO one paragraph: what the visitor does and what they see change.

- **Live:** https://dg-devrel-demos.fly.dev/demos/$name/

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

\`\`\`bash
FEATURE=$name pnpm dev
\`\`\`

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
MD
echo "demos/$name/ from $from"
echo "next: edit index.tsx and meta.json, fill the headline, param and flux of its index/demos.json entry, then FEATURE=$name pnpm dev"
