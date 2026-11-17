#!/usr/bin/env bash
# Rebuilds support-call.mp3, the committed sample: six turns of a support call in two Deepgram Flux
# voices (flux-wes-en and flux-drew-en) from /v2/speak, 0.3 s apart, 16 kHz mono mp3, about 18 s and
# 100 KB. Synthetic, from Deepgram's own text-to-speech. Needs ffmpeg and DEEPGRAM_API_KEY in .env.
# Run from the repo root: FEATURE=diarize-model-v2 pnpm sample
set -euo pipefail
command -v ffmpeg >/dev/null || { echo "needs ffmpeg (brew install ffmpeg)"; exit 1; }
set -a; . ./.env; set +a
: "${DEEPGRAM_API_KEY:?set DEEPGRAM_API_KEY in .env}"

out=demos/diarize-model-v2/support-call.mp3
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

lines=(
  "flux-wes-en|Thanks for calling Acme support, this is Dan. How can I help?"
  "flux-drew-en|Hi Dan. My order arrived yesterday, but the box was empty."
  "flux-wes-en|Sorry about that. What is the order number?"
  "flux-drew-en|Four eight one five."
  "flux-wes-en|Got it. I will send a replacement today."
  "flux-drew-en|Great, thanks."
)

list="$tmp/list.txt"
i=0
for entry in "${lines[@]}"; do
  voice=${entry%%|*}; text=${entry#*|}
  curl -sf -o "$tmp/$i.mp3" -X POST "https://api.deepgram.com/v2/speak?model=$voice" \
    -H "Authorization: Token $DEEPGRAM_API_KEY" -H 'Content-Type: application/json' \
    -d "{\"text\":\"$text\"}"
  ffmpeg -loglevel error -y -i "$tmp/$i.mp3" -af "apad=pad_dur=0.3" -ar 16000 -ac 1 "$tmp/$i.wav"
  echo "file '$tmp/$i.wav'" >> "$list"
  i=$((i + 1))
done

ffmpeg -loglevel error -y -f concat -safe 0 -i "$list" -ar 16000 -ac 1 -b:a 48k "$out"
echo "wrote $out"
