#!/usr/bin/env bash
# Builds an 11-second clip with three invented product names (Kallistrum, Vexmoor, Trellisync)
# from the macOS voice Samantha. macOS only. Output is git-ignored: Apple's voices are fine for
# local testing, not for redistribution. Run from the repo root: pnpm sample
set -euo pipefail
command -v say >/dev/null || { echo "needs macOS 'say'"; exit 1; }
command -v ffmpeg >/dev/null || { echo "needs ffmpeg (brew install ffmpeg)"; exit 1; }

out=samples
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

say -v Samantha -o "$tmp/clip.aiff" "Welcome to the Kallistrum onboarding. Today we will set up Vexmoor \
and connect it to your Trellisync dashboard. If Vexmoor shows an error, restart Kallistrum, then open \
Trellisync again."
ffmpeg -loglevel error -y -i "$tmp/clip.aiff" -ar 16000 -ac 1 -b:a 64k "$out/keyterm.mp3"
echo "wrote $out/keyterm.mp3"
