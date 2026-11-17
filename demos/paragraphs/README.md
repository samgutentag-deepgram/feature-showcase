# Paragraphs

**A wall of text, or paragraphs?** Record yourself reading two short topics, about 25 seconds. With
`paragraphs=true` the pre-recorded response groups the transcript into paragraphs of sentences, each
with start and end times. Run it off to see the same words as one block.

- **Live:** https://dg-devrel-demos.fly.dev/demos/paragraphs/
- **Kind:** Speech-to-text (Nova-3, pre-recorded)
- **Docs:** https://developers.deepgram.com/docs/paragraphs

## What to try

- **The phrase.** Two topics, five sentences each: a work update, then the office kitchen. Press
  **Record**, read both, stop, and the page sends one POST. Then untick **Turn on paragraphs** and
  record it again. The runs sit side by side.
- **Where it breaks.** In testing, Deepgram started a new paragraph after every fifth sentence. A
  6 second pause or a change of subject inside five sentences did not start one. That is why each
  topic is five sentences long: the break lands on the change of subject.
- **The wire.** The Request card shows the exact POST. The Response card shows the first sentence of
  `paragraphs.paragraphs[]` and how many paragraphs came back.

No upload and no bundled clip: the mic recording is the audio. Record stops itself at 30 seconds.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  record up to 30 s from the mic, wrap as WAV
  │  POST /v1/listen?model=nova-3&punctuate=true&paragraphs=true ──────▶
  │  ◀── results.channels[0].alternatives[0].paragraphs.paragraphs[].sentences[]
```

- `paragraphs` is pre-recorded only. The streaming `/v1/listen` socket and Flux `/v2/listen` both
  answer it with a 400 at the handshake.
- `paragraphs=true` turns punctuation on by itself (`punctuate=false` alongside it still came back
  punctuated). The page sends `punctuate=true` on both runs so the only difference is the paragraphs.
- Each paragraph has `sentences[]` (`text`, `start`, `end`), `num_words`, `start`, and `end`.
  `paragraphs.transcript` is the same text with blank lines between paragraphs.
- With `diarize=true` each paragraph also gets a `speaker`, and the docs say speaker changes start
  new paragraphs. This page does not send it.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=paragraphs pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`paragraphs.test.ts`](paragraphs.test.ts) | Unit tests for reading paragraphs out of a response, run by `pnpm test` |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx).

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: POST /v1/listen?model=nova-3&punctuate=true&paragraphs=true on a macOS say
clip of the phrase (20 s) came back as 2 paragraphs of 5 sentences each, the break at 9.04 s to
10.33 s on the change of subject; paragraphs=false came back with the same punctuated transcript and
no paragraphs. ONLY=paragraphs pnpm verify:live passed both variants.
```
