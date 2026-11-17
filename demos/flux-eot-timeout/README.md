# Flux end-of-turn timeout

**How long will Flux wait for you?** Start a sentence, trail off, and stay quiet. `eot_timeout_ms` is the most silence Flux allows before it ends the turn anyway, sure or not. Every `EndOfTurn` says why it ended in `trigger`: `model` when Flux decided you were done, `timeout` when the clock ran out.

- **Live:** https://dg-devrel-demos.fly.dev/demos/flux-eot-timeout/
- **Kind:** Speech-to-text (Flux only)
- **Docs:** https://developers.deepgram.com/docs/flux/configuration

## What to try

- **5000, then 1000.** With `eot_threshold` at 1.0 (the page's starting point), press **Start mic**, say "So I was thinking that maybe we could...", and stay quiet. The silence counter fills, and `EndOfTurn` lands a little after 5 s with `trigger: "timeout"`. Pick 1000 and do it again: a little after 1 s.
- **Let Flux decide.** Pick `eot_threshold` 0.7, Flux's default, and trail off again. In our test Flux ended the turn itself after about a second (`trigger: "model"`), before any of the three timeouts.

Every phrase on the page is a suggestion. Your own words work too.

`eot_timeout_ms` takes 500 to 60000 (default 5000); 499 and 60001 are a 400 at the handshake. `eot_threshold=1.0` turns off Flux's own end of turn so the timeout is the only thing that can end one. Tuning `eot_threshold` itself is the `turn-detection` demo.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&eot_threshold=1.0&eot_timeout_ms=5000
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ TurnInfo: StartOfTurn, Update, EndOfTurn (trigger) ═══
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Flux keeps sending `Update` while you are quiet. The page shows the silence so far as
  `audio_window_end` minus the end time of the last word, against the timeout you picked.
- Each `EndOfTurn` lands in the run's timeline. The page shows its `trigger`, the silence before
  it (same sum), and `end_of_turn_confidence`. Measured that way, a timeout end comes about 0.2 to
  0.4 s after the setting.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-eot-timeout pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, the two settings, the turn readout and silence counter, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`flux-eot-timeout.test.ts`](flux-eot-timeout.test.ts) | Unit tests for this demo, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

TODO
