# Flux eager end of turn

**Start the reply before they finish.** Read a line with a hesitation in the middle. With `eager_eot_threshold` set, Flux sends `EagerEndOfTurn` when it is fairly sure you are done, so a voice agent can start its LLM call early. If you keep talking, `TurnResumed` cancels that draft. `EndOfTurn` confirms the last one with the same transcript, and the gap between them is the head start the agent gets.

- **Live:** https://dg-devrel-demos.fly.dev/demos/flux-eager-eot/
- **Kind:** Speech-to-text (Flux only)
- **Docs:** https://developers.deepgram.com/docs/flux/voice-agent-eager-eot

## What to try

- **Off, then 0.4.** Leave eager end of turn off, press **Start mic**, and say "I'd like to book... um... a table for two." Then pick 0.4 and say it again. The second run shows drafts that start on "I'd like to book.", a `TurnResumed` that cancels each one when you carry on, and the head start on the draft that held.
- **0.4 against 0.6.** A higher threshold sends fewer drafts, so fewer get cancelled, and the one that holds lands closer to `EndOfTurn`.

Every phrase on the page is a suggestion. Your own words work too.

`eot_threshold=0.7` (Flux's default) goes on every run. `eager_eot_threshold` must be between 0.3 and 0.9 and no higher than `eot_threshold`; 0.8 here is a 400 at the handshake. The default turn flow, with no eager events, is the `flux-turn-events` demo.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&eager_eot_threshold=0.4&eot_threshold=0.7
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ TurnInfo: StartOfTurn, EagerEndOfTurn, TurnResumed, EndOfTurn ═══
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Every `TurnInfo` lands in the run's timeline, with `EagerEndOfTurn`, `TurnResumed`, and
  `EndOfTurn` marked. Per turn, the page counts the drafts an agent would start (one LLM call per
  `EagerEndOfTurn`), the ones `TurnResumed` cancelled, and the head start: the time between the
  `EagerEndOfTurn` that held and `EndOfTurn`, as the page received them.
- Runs stay side by side, so off and on can be read against each other.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-eager-eot pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, the setting, the turn tracks and head start, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`flux-eager-eot.test.ts`](flux-eager-eot.test.ts) | Unit tests for this demo, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

TODO
