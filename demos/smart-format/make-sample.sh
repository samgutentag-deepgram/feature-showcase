#!/usr/bin/env bash
# Builds a 20-second clip full of numbers, a date, a price, and a phone number from the macOS
# voice Samantha. macOS only. Output is git-ignored: Apple's voices are fine for local testing,
# not for redistribution. Run from the repo root.
set -euo pipefail
command -v say >/dev/null || { echo "needs macOS 'say'"; exit 1; }
command -v ffmpeg >/dev/null || { echo "needs ffmpeg (brew install ffmpeg)"; exit 1; }

out=samples
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

say -v Samantha -o "$tmp/clip.aiff" "Hi, this is Dana from Acme. Your order number is four eight one five \
one six two three four two, and it ships on March third, twenty twenty six. The total comes to one \
hundred twenty nine dollars and ninety nine cents. Call us back at five five five, two one two, eight \
eight nine nine."
ffmpeg -loglevel error -y -i "$tmp/clip.aiff" -ar 16000 -ac 1 -b:a 64k "$out/smart-format.mp3"
echo "wrote $out/smart-format.mp3"
