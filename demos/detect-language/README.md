# Language detection

**Which language did I just speak?** Pick a line in a language you speak, record it, and Nova-3
names the language with `detected_language` and how sure it is with `language_confidence`. Then
limit detection to a short list and read a line that is not on it.

- **Live:** https://dg-devrel-demos.fly.dev/demos/detect-language/
- **Kind:** Speech-to-text, pre-recorded (Nova-3 only)
- **Docs:** https://developers.deepgram.com/docs/language-detection

## What to try

- **Your language.** Pick a language you speak under **I will read a line in**, press the mic,
  read the line, and press **Stop and transcribe**. The panel shows the language Deepgram picked,
  its code, and the confidence; the transcript below is in that language.
- **A list.** Tick **Limit detection to a list** (English and Spanish to start), then read the
  French line, or any line not on the list. Detection has to pick from the list, and the
  confidence drops near zero. The two runs sit side by side.
- **The wire.** The Request card shows the exact POST, with `detect_language=true` or one
  `detect_language` per language on the list. The Response card shows
  `results.channels[0].detected_language` and `language_confidence` verbatim.

`detect_language` is pre-recorded only. Both sockets refuse it at the handshake with a 400
(`/v1/listen` on Nova-3 and `/v2/listen` on Flux), so the page records up to 30 seconds from the
mic and sends the clip in one POST. It finds one language per clip; for speech that switches
languages mid-sentence, use `language=multi`. No upload: reading the line shows the effect.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  record the mic, wrap it as WAV
  │  POST /v1/listen?model=nova-3&detect_language=true  (Authorization: Bearer <token>)
  │  ─────────────────────────────────────────────────────▶
  │  ◀── results.channels[0]: detected_language "fr", language_confidence 0.995
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=detect-language pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, the phrase per language, controls, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The phrase picker, the language list, and the detected-language panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

```text
Verified live 2026-11-16: ONLY=detect-language pnpm verify:live passed (both POSTs, detect_language=true and detect_language=en&detect_language=es, and the prompt), and say clips came back en 0.998, es 0.999, fr 0.995, de 0.9998, ja 0.999, hi 0.9999.
```
