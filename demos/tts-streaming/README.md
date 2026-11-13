# Streaming text-to-speech

**Hear it before it finishes.** Deepgram streams the audio back as it is generated. Speak a long line both ways: wait for the whole file, or play the raw samples as each chunk arrives. Compare the first-audio time on each run.

- **Live:** https://dg-devrel-tts-streaming.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/streaming-the-audio-output

## What to try

- **Both ways.** Press **Speak** with **Wait for the file**, then switch to **Play as it arrives** and press it again. Compare **First audio** on the two runs.
- **What we saw in testing.** The first byte arrived in 150 to 330 ms and the last in about 2.2 s for a two-sentence line, so waiting for the file costs about 2 seconds of silence.
- **A longer line.** The longer the text, the bigger the gap.

Lines to try sit under the text box. Your own text works too, up to 400 characters.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  POST /v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=24000&container=none
  │  body {"text": "..."}  ──────────────────────────────▶
  │  ◀═══ audio, streamed in chunks ══════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser.
- `container=none` audio is played chunk by chunk as it arrives; anything else is decoded once the
  whole file is in. Mu-law is decoded in the page.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-streaming pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-streaming`.

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
Play text-to-speech as it arrives, or wait for the file. Verified live 2026-11-11, the
3-sentence first phrase, 3 runs each, container=wav and none alike:
  POST /v2/speak flux-wes-en:      first byte 206-324 ms, last byte 5175-6064 ms, 126-202 chunks
  POST /v1/speak aura-2-thalia-en: first byte 115-326 ms, last byte 3322-3861 ms, 179-211 chunks
So the wait is on the client: with container=wav this page decodes the whole file before it
plays, the way most code handles a file. With container=none it plays raw 16-bit samples as
each chunk lands. Same request otherwise, same audio.
Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
spread (0.08 s) of 14 Flux voices tried.
```
