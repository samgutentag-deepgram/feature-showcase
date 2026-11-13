#!/usr/bin/env bash
# Builds a 21-second support call with two speakers from the macOS voices Samantha and Daniel,
# five turns with a short pause between each. macOS only. Output is git-ignored: Apple's voices
# are fine for local testing, not for redistribution. Run from the repo root: pnpm sample
set -euo pipefail
command -v say >/dev/null || { echo "needs macOS 'say'"; exit 1; }
command -v ffmpeg >/dev/null || { echo "needs ffmpeg (brew install ffmpeg)"; exit 1; }

out=samples
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

lines=(
  "Samantha|Thanks for calling Acme support, this is Dana. How can I help?"
  "Daniel|Hi Dana. My order arrived yesterday, but the box was empty."
  "Samantha|I'm sorry about that. Can you read me the order number?"
  "Daniel|Sure, it's on the receipt. Give me one second to find it."
  "Samantha|No problem. I'll send a replacement today either way."
)

list="$tmp/list.txt"
i=0
for entry in "${lines[@]}"; do
  voice=${entry%%|*}; text=${entry#*|}
  say -v "$voice" -o "$tmp/$i.aiff" "$text"
  ffmpeg -loglevel error -y -i "$tmp/$i.aiff" -af "apad=pad_dur=0.7" -ar 16000 -ac 1 "$tmp/$i.wav"
  echo "file '$tmp/$i.wav'" >> "$list"
  i=$((i + 1))
done

ffmpeg -loglevel error -y -f concat -safe 0 -i "$list" -ar 16000 -ac 1 -b:a 64k "$out/diarize.mp3"
echo "wrote $out/diarize.mp3"
