#!/usr/bin/env bash
# Builds a 23-second billing call with a test card number (4111 1111 1111 1111, the standard
# Visa test number), an expiry, a CVV, a made-up SSN, and a 555 phone number, from the macOS
# voice Samantha. None of it is real. macOS only. Output is git-ignored. Run from the repo root:
# pnpm sample
set -euo pipefail
command -v say >/dev/null || { echo "needs macOS 'say'"; exit 1; }
command -v ffmpeg >/dev/null || { echo "needs ffmpeg (brew install ffmpeg)"; exit 1; }

out=samples
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

say -v Samantha -o "$tmp/clip.aiff" "Hi, I want to update my billing. My card number is four one one one, \
one one one one, one one one one, one one one one. It expires oh nine, twenty eight, and the security \
code is seven three seven. My social security number is one two three, four five, six seven eight nine. \
Call me back at four one five, five five five, oh one three four."
ffmpeg -loglevel error -y -i "$tmp/clip.aiff" -ar 16000 -ac 1 -b:a 64k "$out/redact.mp3"
echo "wrote $out/redact.mp3"
