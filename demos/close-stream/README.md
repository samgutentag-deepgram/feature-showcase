# Close stream

**Say goodbye, or just hang up?** Read a line, and while you are still saying the last words, end
the stream one of two ways. CloseStream asks Deepgram to finish: on Nova-3 the last words come back
final, then a `Metadata` summary (`request_id`, `duration`), then a 1000 close. Hang up drops the
socket, and the words still in flight never come back final, with no Metadata.

- **Live:** https://dg-devrel-demos.fly.dev/demos/close-stream/
- **Kind:** Speech-to-text (Flux and Nova-3)
- **Docs:** https://developers.deepgram.com/docs/close-stream and, for Flux,
  https://developers.deepgram.com/docs/flux/close-stream

## What to try

- **Nova-3, both ways.** Pick Nova-3, press **Start mic**, read the line, and press
  **CloseStream** while you say "Tuesday morning". Read it again and press **Hang up (close socket)**
  instead. The two runs sit side by side: the first keeps every word and shows Metadata, the second
  strikes through the words that were only ever interim.
- **Flux.** On Flux, CloseStream decodes what it has left (an `Update`, if any) and closes with no status
  code. It does not end the turn and sends no Metadata, so the open turn shows dashed. Press
  **ForceEndTurn** first, then **CloseStream**, and the turn comes back as an `EndOfTurn`.
- **The wire.** The Request card lists the messages each button sends. The Response card shows the
  Metadata summary, or says none came. The timeline under each run shows what arrived after the press.

Use the buttons, not the mic's Stop: Stop ends the stream the clean way for you.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  {"type":"CloseStream"} ──────────────────────────────▶
  │  ◀═══ Results is_final: "...on Tuesday morning" ═════════
  │  ◀═══ Metadata: request_id, duration ════════════════════
  │  ◀═══ close 1000 ════════════════════════════════════════
```

Hang up is a button with no message: the page stops the mic and closes the socket itself, a few
seconds later. Nothing arrives in between (checked live).

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=close-stream pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, the three buttons, the run summary. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The run summary and the struck-through and dashed words |
| [`close-stream.test.ts`](close-stream.test.ts) | Unit tests for the run summary and the buttons |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: ONLY=close-stream pnpm verify:live passed. /v2/listen?model=flux-general-en and /v1/listen?model=nova-3 opened; ForceEndTurn came back EndOfTurn on Flux; CloseStream came back Metadata then a clean close on Nova-3, and closed cleanly with no Error on Flux (the run before, which waited for an Update after it, got none, so that Update is not guaranteed); prompt.md URLs accepted.
```
