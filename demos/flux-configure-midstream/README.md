# Flux Configure mid-stream

**Teach Flux a new word mid-call.** Start the mic and read a line with two made-up product names.
Pause until the turn ends, press **Send Configure**, and read the same line again. One socket the
whole time: the keyterms (and, if ticked, a stricter `eot_threshold` and `numerals`) apply from the
next audio on, and the page shows the turns before and after with the Configure and Flux's answer
in between.

- **Live:** https://dg-devrel-demos.fly.dev/demos/flux-configure-midstream/
- **Kind:** Speech-to-text (Flux only)
- **Docs:** https://developers.deepgram.com/docs/flux/configure

## What to try

- **The suggested phrase.** "Please open the Kallistrum dashboard and sync it with Vexmoor." Read
  it, wait for the Before row, press **Send Configure**, read it again. In testing, Flux wrote
  "colistrum" and "Vexmor" before, and both names right after.
- **Your own words.** Type terms separated by commas, even mid-run. Send Configure sends whatever
  is typed right then. Configure replaces the whole list; **Clear keyterms** sends `"keyterms": []`.
- **A rejected value.** **Send an invalid Configure** sends `eager_eot_threshold` 0.9 over
  `eot_threshold` 0.5. Flux answers `ConfigureFailure` and keeps transcribing with the old settings.
- **What ends the run.** A message that breaks the schema, such as `"numerals": "true"` as a string,
  gets an `Error` and Flux closes the socket. The page has no button for that; it is checked live
  below.

File upload is off in this demo; reading the phrase twice shows the effect.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&eot_threshold=0.7
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ TurnInfo EndOfTurn: "...colistrum..." ═════════════
  │  ── {"type":"Configure","keyterms":["Kallistrum","Vexmoor"]} ──▶
  │  ◀═══ ConfigureSuccess: the whole active setup ══════════
  │  ═══ the same line again ═══════════════════════════════▶
  │  ◀═══ TurnInfo EndOfTurn: "...Kallistrum..." ════════════
```

- The URL sets the starting values (`eot_threshold=0.7`, Flux's default). Configure is a JSON text frame on the open socket that changes them; the socket never reconnects.
- Fields left out keep their values. Thresholds nest under `"thresholds"`; `numerals` is top level.
- `ConfigureSuccess` echoes every active setting, including the ones you did not change.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-configure-midstream pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the Configure messages, controls, the before/after view, copy. The comment at the top records what was checked live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: ONLY=flux-configure-midstream pnpm verify:live passed. /v2/listen?model=flux-general-en&eot_threshold=0.7 opened in both variants; Send Configure (keyterms, plus eot_threshold 0.8 and numerals true) and Clear keyterms came back ConfigureSuccess, Send an invalid Configure came back ConfigureFailure, with no Error; prompt.md URL accepted.
```

Also checked by hand on one socket with a macOS voice clip read twice: before Configure, "colistrum" and "Vexmor"; after `{"type":"Configure","keyterms":["Kallistrum","Vexmoor"]}`, both right. `{"type":"Configure","numerals":"true"}` got an Error and Flux closed the socket.
