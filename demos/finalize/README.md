# Finalize

**Done talking? Say so.** Read the line, then press Finalize now the moment you stop. Deepgram turns
what it is holding into a final result right away, instead of waiting out a second of silence. Run
it again without the button to compare.

- **Live:** https://dg-devrel-demos.fly.dev/demos/finalize/
- **Kind:** Speech-to-text (Nova-3 only)
- **Docs:** https://developers.deepgram.com/docs/finalize

## What to try

- **Press it.** Press **Start mic**, read the suggested line, and press **Finalize now** as you
  finish the last word. The button shows `Results from_finalize in N ms`, and the summary under the
  transcript says how long the press took to come back.
- **Wait instead.** Run it again and do not press the button. The line closes on its own with
  `speech_final` once Deepgram hears a second of silence (`endpointing=1000`). The two runs sit side
  by side.
- **Keep going.** Finalize does not close the socket. Read the line again in the same run and press
  again: each press closes one line. To end the stream, use **Stop** (that is `CloseStream`, its own
  demo).
- **The wire.** The Request card shows the query and the `{"type":"Finalize"}` message the button
  sends. The Response card shows `from_finalize`, `speech_final`, and the transcript of the last
  final result. The timeline under each run marks the Finalize sent and the result that answered.

Mic only, no upload: one person reading the line shows the effect.

## Why Nova-3 only

Flux does not take `Finalize`. On `/v2/listen` it answers with an Error
(`UNPARSABLE_CLIENT_MESSAGE`, "unknown variant `Finalize`, expected one of `CloseStream`,
`ForceEndTurn`, `Configure`") and closes the socket. Flux's way to end a turn early is
`ForceEndTurn`, shown in the `flux-force-end-turn` demo.

## Why endpointing=1000

The comparison needs a `speech_final` to compare against. At `endpointing=1500` or `2000`, Nova-3
sent the words as an `is_final` without `speech_final` and then nothing more on them, so there was
no endpointing result to show. At `1000` it came reliably, about 1.2 s of silence after the last word.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&endpointing=1000
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ── {"type":"Finalize"} ───────────────────────────────▶
  │  ◀═══ Results from_finalize: true, "book a table for four…" ══
  │  (socket still open; keep talking)
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=finalize pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, the Finalize action, timeline, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The summary under each transcript |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Finalize on Nova-3: flush the audio Deepgram is holding into a final result now, like a
push-to-talk release, and keep the socket open for the next line.
Checked live 2026-11-16 on /v1/listen (model=nova-3&endpointing=1000, a 3.5 s line streamed at
real time): Finalize came back as Results from_finalize (also speech_final) in 38 to 113 ms, and
the socket stayed open. Without it, speech_final came after 1.21 s of silence. endpointing=1500 or
2000 never sent speech_final on the words (an is_final without it, then nothing), so the page
uses 1000. Flux answers Finalize with Error UNPARSABLE_CLIENT_MESSAGE and closes the socket.
Verified live 2026-11-16: verify:live opened /v1/listen?model=nova-3&endpointing=1000, streamed the phrase, sent {"type":"Finalize"} and got Results from_finalize back on an open socket; in a scripted probe with a macOS say clip, Finalize answered in 38 to 113 ms, speech_final alone after 1.21 s of silence.
```
