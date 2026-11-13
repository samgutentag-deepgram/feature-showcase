#!/usr/bin/env bash
# Builds a Spanish/Catalan code-switching test clip from the macOS voices
# Mónica (es_ES) and Montse (ca_ES). macOS only. Output is git-ignored:
# Apple's voices are fine for local testing, not for redistribution.
set -euo pipefail
command -v say >/dev/null || { echo "needs macOS 'say'"; exit 1; }
command -v ffmpeg >/dev/null || { echo "needs ffmpeg (brew install ffmpeg)"; exit 1; }

out=samples
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

# Alternating lines, the way people in Barcelona switch mid-conversation.
lines=(
  "es|Oye, ¿has visto lo que ha pasado con el metro esta mañana?"
  "ca|Sí, home, la línia verda anava plena a vessar i he arribat tard a la feina."
  "es|Pues yo he cogido el autobús y tampoco ha sido mucho mejor."
  "ca|Doncs aquesta tarda podríem anar caminant fins a la platja, fa un dia fantàstic."
  "es|Vale, pero primero tengo que terminar un informe para mi jefe."
  "ca|Cap problema, t'espero a la plaça a les sis i després sopem alguna cosa."
)

list="$tmp/list.txt"
i=0
for entry in "${lines[@]}"; do
  lang=${entry%%|*}; text=${entry#*|}
  voice=$([ "$lang" = ca ] && echo Montse || echo Mónica)
  say -v "$voice" -o "$tmp/$i.aiff" "$text"
  ffmpeg -loglevel error -y -i "$tmp/$i.aiff" -af "apad=pad_dur=0.6" -ar 16000 -ac 1 "$tmp/$i.wav"
  echo "file '$tmp/$i.wav'" >> "$list"
  i=$((i + 1))
done

ffmpeg -loglevel error -y -f concat -safe 0 -i "$list" -ar 16000 -ac 1 -b:a 64k "$out/es-ca-switch.mp3"
echo "wrote $out/es-ca-switch.mp3"
