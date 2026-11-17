# Speech started

**Know they started talking before the first word.** Start the mic, stay quiet for two seconds, then read the phrase. With vad_events on, Nova-3 sends a `SpeechStarted` message as soon as you make a sound, ahead of the first transcript. The line above the transcript says how much sooner, and the timeline under it lists every message with its arrival time.

- **Live:** https://dg-devrel-demos.fly.dev/demos/speech-started/
- **Kind:** Speech-to-text (Nova-3 only)
- **Docs:** https://developers.deepgram.com/docs/speech-started

## What to try

- **The suggested phrase.** Press **Start mic**, wait two seconds, and read it with vad_events off. Tick the box and do it again. The second run gains a marked `SpeechStarted` row.
- **Barge-in.** This is the signal a voice agent uses to stop talking when the caller cuts in, without waiting for words.
- **The wire.** The Response card shows the last `SpeechStarted` message: `type`, `channel`, and `timestamp` (seconds into the audio).

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&vad_events=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ SpeechStarted, then transcripts ════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Flux answers `vad_events` with a 400. Its `StartOfTurn` arrives with the first words, so it is
  not an earlier signal, and the page offers Nova-3 only.
- The `timestamp` is audio time and can differ from the first word's `start`; the docs note the two
  come from separate systems. The page compares arrival times instead.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=speech-started pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, controls, copy, the lead line. The comment at the top records what was verified live |
| [`speech-started.test.ts`](speech-started.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`styles.css`](styles.css) | The lead line above the transcript |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx).

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: ONLY=speech-started pnpm verify:live passed (vad_events=false and =true accepted on nova-3, docs link resolves); in real time, 2 s of silence then the phrase, SpeechStarted (timestamp 2.09) arrived 0.52 s before the first word ("hey", start 1.84).
```
