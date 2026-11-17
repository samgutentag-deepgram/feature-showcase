#!/usr/bin/env bash
# Rebuilds call-stereo.mp3, the committed sample: a six-line support call in two Deepgram Flux voices
# from /v2/speak, the agent (flux-wes-en) on the left channel and the customer (flux-drew-en) on the
# right, each silent while the other talks. 16 kHz stereo mp3, about 18 s. Synthetic, from Deepgram's
# own text-to-speech. Needs ffmpeg and DEEPGRAM_API_KEY in .env.
# Run from the repo root: FEATURE=multichannel pnpm sample
set -euo pipefail
command -v ffmpeg >/dev/null || { echo "needs ffmpeg (brew install ffmpeg)"; exit 1; }
set -a; . ./.env; set +a
: "${DEEPGRAM_API_KEY:?set DEEPGRAM_API_KEY in .env}"

out=demos/multichannel/call-stereo.mp3
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# side|voice|text. L is the agent, R is the customer.
lines=(
  "L|flux-wes-en|Thanks for calling Acme support, this is Dan. How can I help?"
  "R|flux-drew-en|Hi Dan. My order arrived yesterday, but the box was empty."
  "L|flux-wes-en|Sorry about that. What is the order number?"
  "R|flux-drew-en|Four eight one five."
  "L|flux-wes-en|Got it. I will send a replacement today."
  "R|flux-drew-en|Great, thanks."
)

# Each line becomes a stereo piece: the voice on its side, silence on the other, 0.3 s of air after.
list="$tmp/list.txt"
i=0
for entry in "${lines[@]}"; do
  side=${entry%%|*}; rest=${entry#*|}; voice=${rest%%|*}; text=${rest#*|}
  curl -sf -o "$tmp/$i.mp3" -X POST "https://api.deepgram.com/v2/speak?model=$voice" \
    -H "Authorization: Token $DEEPGRAM_API_KEY" -H 'Content-Type: application/json' \
    -d "{\"text\":\"$text\"}"
  if [ "$side" = L ]; then pan='stereo|c0=c0|c1=0*c0'; else pan='stereo|c0=0*c0|c1=c0'; fi
  ffmpeg -loglevel error -y -i "$tmp/$i.mp3" -af "aresample=16000,pan=$pan,apad=pad_dur=0.3" -ac 2 "$tmp/$i.wav"
  echo "file '$tmp/$i.wav'" >> "$list"
  i=$((i + 1))
done

ffmpeg -loglevel error -y -f concat -safe 0 -i "$list" -ar 16000 -ac 2 -b:a 64k -joint_stereo 0 "$out"
echo "wrote $out"
