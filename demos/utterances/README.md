# Utterances

**How long a pause starts a new utterance?** Record three short lines with a pause of about a second and a
longer one between them. With `utterances=true` the pre-recorded response adds `results.utterances[]`:
timed rows, each with a transcript and a confidence. `utt_split` is how many seconds of silence end
one row. Record again with another value and compare where the splits land.

- **Live:** https://dg-devrel-demos.fly.dev/demos/utterances/
- **Kind:** Speech-to-text (Nova-3, pre-recorded)
- **Docs:** https://developers.deepgram.com/docs/utterances and
  https://developers.deepgram.com/docs/utterance-split

## What to try

- **The phrase.** Pick **utt_split=0.8**, press **Start recording**, read the lines with a pause of
  about a second and then a longer one (count to two), and stop. Then pick **utt_split=3** and read
  them again the same way. The runs sit side by side. On a `say` clip with those pauses, 0.8 gave
  three rows, 1.5 gave two, and 3 gave one. A shorter first pause (0.5 s) did not split even at 0.8.
- **The gaps.** Between rows the page shows the time from the last word of one row to the first word
  of the next. Those are word times, so they read shorter than the silence you left.
- **The wire.** The Request card shows the exact POST. The Response card shows the first entry of
  `results.utterances[]` and how many came back.

No upload and no bundled clip: the mic recording is the audio. Record stops itself at 30 seconds.

This is not the streaming `UtteranceEnd` event (`utterance_end_ms`, see the utterance-end demo) and
not `paragraphs` (sentences grouped by topic, see the paragraphs demo). Utterances are split by
silence alone, after the whole clip is in.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  record up to 30 s from the mic, wrap as WAV
  │  POST /v1/listen?model=nova-3&punctuate=true&utterances=true&utt_split=1.5 ──▶
  │  ◀── results.utterances[]: start, end, confidence, channel, transcript, words, id
```

- Pre-recorded only. Flux `/v2/listen` answers `utterances=true` and `utt_split` with a 400 at the
  handshake. The streaming `/v1/listen` socket opens with both but sends only `Results` and
  `Metadata`, never an `utterances` field.
- `utt_split` defaults to 0.8. On macOS `say` clips, every value from 0.05 to 0.8 split in the same
  places (a measured 0.3 s silence never split; a 0.7 s one split at 0.8 and below, not at 1.0), so
  the choices here start at 0.8.
- `punctuate=true` is sent on every run so each row reads as sentences.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=utterances pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`utterances.test.ts`](utterances.test.ts) | Unit tests for reading utterances out of a response, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx).

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: POST /v1/listen?model=nova-3&punctuate=true&utterances=true&utt_split=<v> on a
macOS say clip of the phrase with 0.5 s and 1.2 s silences gave 2 utterances at 0.8, 2 at 1.5, 1 at
3; with 0.8 s and 2.0 s silences, 3 at 0.8, 2 at 1.5, 1 at 3, each row with start, end, confidence
0.99 or above and transcript. ONLY=utterances pnpm verify:live passed all three variants.
```
