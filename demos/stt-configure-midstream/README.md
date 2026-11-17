# Configure mid-stream on Nova-3

**New keyterms, same socket.** Read the phrase, press **Send keyterms**, and read it again. One
`Configure` message swaps the keyterms on the open Nova-3 stream: no reconnect, no dropped audio.

- **Live:** https://dg-devrel-demos.fly.dev/demos/stt-configure-midstream/
- **Kind:** Speech-to-text (Nova-3 only)
- **Docs:** https://developers.deepgram.com/docs/configure

## What to try

- **Before and after in one run.** Press **Start mic** and read the phrase. The stream opens with
  no keyterms, so the invented names come out wrong (in testing: "Colistrum", "Vexmar"). Press
  **Send keyterms**, wait for `ConfigureSuccess` on the button, and read the phrase again. The
  transcript is cut where the Configure went out, so the second half shows "Kallistrum" and
  "Vexmoor" spelled right.
- **Numerals.** Press **Turn numerals on** and read the phrase once more: "four eight one five"
  becomes "4 8 1 5".
- **Your own words.** Edit the keyterm box, even mid-run, and press **Send keyterms** again. Each
  `keyterms` array replaces the whole list. **Clear keyterms** sends an empty one.
- **The wire.** The Request card shows the URL and each Configure message. The Response card shows
  Deepgram's latest answer to a Configure. The timeline under the run shows each Configure, its
  `ConfigureSuccess`, and every final result in order.

Flux has its own Configure on `/v2/listen` (thresholds, keyterms, language hints, numerals at the
top level). It has a separate demo, so this one is Nova-3 only.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&punctuate=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results ═══════════════════════════════════════════
  │  ── {"type":"Configure","keyterms":["Kallistrum","Vexmoor"]} ─▶
  │  ◀══ {"type":"ConfigureSuccess","keyterms":[...]} ════════
  │  ◀═══ Results, now with the keyterms ═════════════════════
```

- The stream opens without `keyterm`. The Configure adds them.
- Deepgram applies a Configure to audio it has not transcribed yet. Results it already sent are
  not revised, so a line right after the cut can already use the new list.
- `ConfigureSuccess` echoes `keyterms` only when the message replaced them. A misspelled field
  (`keyterm`) is an `Error` and the stream keeps going with its old settings.
- No `smart_format`: it would write the numbers as digits on its own and hide the numerals button.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=stt-configure-midstream pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, Configure buttons, before/after transcript, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

## Verified live

```text
Verified live 2026-11-16: ONLY=stt-configure-midstream pnpm verify:live passed: /v1/listen?model=nova-3&punctuate=true opened, and each of the three Configure messages (keyterms Kallistrum, Vexmoor; features numerals true; keyterms []) came back ConfigureSuccess mid-stream with no Error, plus the prompt URL and docs link.
```
