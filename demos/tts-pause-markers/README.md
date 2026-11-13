# Text-to-speech pause markers

**Give them time to write it down.** Put a pause marker in the text and Flux leaves exactly that much silence, like a beat after reading out a confirmation number. Pick a length and hear the line again: the markers are right there in the text box, and the gap lands within about 100 ms.

- **Live:** https://dg-devrel-tts-pause-markers.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-voice-controls

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-pause-markers pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-pause-markers`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/tts/TtsShell.tsx`](../../shared/tts/TtsShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Exact silences with an inline pause marker, on Flux batch (POST /v2/speak). Verified live
2026-11-12, flux-wes-en and flux-hannah-en, linear16 at 24 kHz:
  "... 4 7 2. \{pause:1s\} Is there ..."  200, dg-breaks-applied: 1. The longest silence inside
  the audio measured 900 ms (1s), 2010 ms (2s), 2960 ms (3s), against 440 ms with no marker.
  {pause:{duration_ms:1500}} (the structured form, no backslashes) is a 200 with one break too.
  \{pause:250\} -> 400 BREAK_OUT_OF_RANGE ("between 500ms and 3000ms").
Batch only: on the Flux socket a pause marker fails the connection (DATA-0002, per the docs).
Flux only: Aura-2 has no pause control. flux-wes-en is the default: the steadiest of 14 English
Flux voices on 2026-11-11.
```
