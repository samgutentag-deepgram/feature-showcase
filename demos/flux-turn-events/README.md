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
Flux turn events: the TurnInfo messages every /v2/listen socket sends, as a state machine.
No eager_eot_threshold here, so this is the default flow (EagerEndOfTurn and TurnResumed only
arrive with it; that is the flux-eager-eot demo).
Checked live 2026-11-16 in real time on "My name is Sam. [2 s pause] I need a table for two."
(macOS voice Samantha), /v2/listen?model=flux-general-en&eot_threshold=0.7, the same twice:
  Connected, Update 0, StartOfTurn 0 "My name", Update 0 x7, EndOfTurn 0 "My name is Sam."
  (confidence 0.72, trigger model), Update 1 x4 (empty: the pause), StartOfTurn 1 "I need",
  Update 1 x9, EndOfTurn 1 "I need a table for two" (0.76, model), Update 2 on the silence after.
  No EagerEndOfTurn or TurnResumed without eager_eot_threshold, as the docs say.
Verified live 2026-11-16: ONLY=flux-turn-events pnpm verify:live passed (3 tests: the /v2/listen?model=flux-general-en&eot_threshold=0.7 socket, the prompt URLs, the docs link); the say clip above came back StartOfTurn 0, EndOfTurn 0 "My name is Sam.", StartOfTurn 1, EndOfTurn 1 "I need a table for two", Updates between, no EagerEndOfTurn or TurnResumed.
```
