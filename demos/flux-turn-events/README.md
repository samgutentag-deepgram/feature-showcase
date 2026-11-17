# Flux turn events

**Watch Flux take turns.** Say two short sentences with a pause between them. Flux answers with `TurnInfo` events: `StartOfTurn` when you begin, `Update` about every quarter second, and `EndOfTurn` when it decides you are done. Each event carries a `turn_index`, and a small state diagram follows the state Flux is in.

- **Live:** https://dg-devrel-demos.fly.dev/demos/flux-turn-events/
- **Kind:** Speech-to-text (Flux only)
- **Docs:** https://developers.deepgram.com/docs/flux/state

## What to try

- **The suggested phrase.** Press **Start mic**, say "My name is Sam.", wait two seconds, then say "I need a table for two." Watch the diagram go Initial, TurnOngoing, Initial, twice, and the list show `turn_index` 0 then 1.
- **Talk without stopping.** Run two sentences together with no pause and see whether Flux keeps them in one turn.

Every phrase on the page is a suggestion. Your own words work too.

This page sends no `eager_eot_threshold`, so it shows the default flow. `EagerEndOfTurn` and `TurnResumed` only arrive when you set it, and the `flux-eager-eot` demo shows them. `eot_timeout_ms` (a cap on how long silence can last) has its own demo, `flux-eot-timeout`.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ TurnInfo events ════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Every `TurnInfo` message lands in the run's event list. A run of `Update` events in one turn folds
  into one quiet row with a count. `StartOfTurn` and `EndOfTurn` are the state changes; the diagram
  highlights where Flux is now. The Response card shows the last state change, with its `trigger`
  on `EndOfTurn` (`model` when Flux decided, `manual` when Stop sent `ForceEndTurn`).

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-turn-events pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, the state diagram, the event list, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`flux-turn-events.test.ts`](flux-turn-events.test.ts) | Unit tests for this demo, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
TODO
```
