# Turn detection

**Did it cut you off?** Start a sentence, pause for a second in the middle, then finish it. Nova-3 ends a turn on silence. Flux listens to what you said, so a pause mid-sentence is not the end. Run it on both and compare.

- **Live:** https://dg-devrel-turn-detection.fly.dev
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/flux/quickstart

## What to try

- **The suggested phrase.** Press **Start mic** on Nova-3 and read it, pause included. Then flip to Flux and read it again.
- **The settings.** Try `endpointing` at 10, 300, and 2000 ms on Nova-3, and `eot_threshold` at 0.5, 0.7, and 0.9 on Flux.
- **What we saw in testing.** Nova-3 at 10 or 300 ms cut "I want to book a table for" off as its own turn. At 2000 ms it never ended a turn. Flux kept both sentences whole at every threshold.

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&eot_threshold=0.7
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ transcripts ════════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- A turn ends on a Nova-3 result with `speech_final: true`, or a Flux `EndOfTurn` event. The Response card shows the last one.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=turn-detection pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh turn-detection`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`turn-detection.test.ts`](turn-detection.test.ts) | Unit tests for this demo, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Turn detection: when does the model decide you stopped talking? Nova-3 waits for silence
(endpointing, in ms); Flux decides from the words and the audio together (eot_threshold).
Verified live 2026-11-09 in real time on "I want to book a table for [1.2 s pause] four people
tomorrow night. [2.5 s] Somewhere quiet, if you can." (macOS voice Samantha):
  Nova-3 endpointing=10     4 turns: "i want to book a table for" | "four people tomorrow night" | ...
  Nova-3 endpointing=300    3 turns, still cut after "a table for"
  Nova-3 endpointing=2000   no turn ends at all
  Flux eot_threshold=0.5, 0.7, 0.9   2 turns: the two full sentences, never cut mid-sentence
```
