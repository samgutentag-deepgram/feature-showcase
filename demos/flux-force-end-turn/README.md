# Flux ForceEndTurn

**You say when the turn ends.** Start the mic and say a sentence that trails off, then stop talking.
With `eot_threshold=1.0`, Flux never ends a turn on its own, so it waits. Press **End turn now**: the
page sends `{"type":"ForceEndTurn"}` on the open socket, and Flux ends the turn right then with an
`EndOfTurn` whose `trigger` is `"manual"`. This is how you keep your own turn detection (push-to-talk,
a VAD, a Send button) and still use Flux for the transcript.

- **Live:** https://dg-devrel-demos.fly.dev/demos/flux-force-end-turn/
- **Kind:** Speech-to-text (Flux only)
- **Docs:** https://developers.deepgram.com/docs/flux/own-turn-detection

## What to try

- **The suggested phrase.** "So for the trip, I was thinking we could maybe…" Stop talking, wait a
  few seconds (nothing happens), then press **End turn now**. The turn row says "Ended by you", with
  the confidence Flux had and how many ms it took to answer. In testing it answered in about 110 ms.
- **Press it twice.** The second press finds no open turn. Flux answers with a `Warning`,
  `FORCE_END_TURN_NO_ACTIVE_TURN`, ignores it, and keeps the socket open.
- **Flux or you.** Switch to `eot_threshold=0.7` (Flux's default) and say it again without pressing
  anything: Flux ends the turn itself, `"trigger": "model"`. Press early and you win; the row shows a
  confidence far below 0.7.
- **The backstop.** On "Only you", `eot_timeout_ms=30000` ends a forgotten turn after 30 s of silence
  with `"trigger": "timeout"`. Not checked live.

File upload is off in this demo; one person reading the phrase shows the effect.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&eot_threshold=1.0&eot_timeout_ms=30000
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ TurnInfo StartOfTurn, Update, Update... ═══════════
  │  ── {"type":"ForceEndTurn"} ──────────────────────────────▶
  │  ◀═══ TurnInfo EndOfTurn, "trigger": "manual" ═══════════
```

- `eot_threshold=1.0` suppresses Flux's own `EndOfTurn`. `eot_timeout_ms` is a safety net, set high so
  it only fires when your own detection misses.
- `ForceEndTurn` has no other fields. The `EndOfTurn` carries the transcript so far, and
  `end_of_turn_confidence` is the model's real confidence at that moment, not 1.0.
- `trigger` is on every `EndOfTurn`: `manual`, `model`, or `timeout`.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-force-end-turn pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the ForceEndTurn action, the who-ends-it picker, the turn rows, copy. The comment at the top records what was checked live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

## Verified live

From the top of `index.tsx`:

```text
TODO
```

Also checked by hand with a macOS voice clip ("So for the trip I was thinking we could maybe, um",
then silence): at `eot_threshold=1.0` no `EndOfTurn` came until `ForceEndTurn`, which got one 110 ms
later with `"trigger":"manual"` and confidence 0.94; a second `ForceEndTurn` got the `Warning`. At
0.7, Flux ended the same line itself at 5.10 s (`"trigger":"model"`), and a `ForceEndTurn` at 3.30 s
ended it 180 ms later with confidence 0.03.
