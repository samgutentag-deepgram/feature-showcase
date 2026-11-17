# Agent defer until end of turn

**Cancel the right order.** On a Flux listen model the voice agent starts on its reply before your
turn is confirmed, and a function call the LLM makes in that window goes out at once. Correct
yourself mid-sentence and the page gets a `cancel_order` call for the wrong order while you are
still talking. Set `defer_until_eot: true` on the function and the call waits for the end of your
turn, so only the order you meant is cancelled.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-defer-until-eot/
- **Kind:** Voice agent, Flux listen model only
- **Docs:** https://developers.deepgram.com/docs/voice-agent-function-call-cancelled and
  https://developers.deepgram.com/docs/voice-agent-speculative-replies

## What to try

- **Off.** Press **Start talking**, wait for the greeting, and say "Cancel order A1234." Pause for
  a short beat (under a second), then "Um, no wait, I meant order B5678." The panel lists two
  `cancel_order` calls: A1234 in red, sent while you were still talking, then B5678.
- **On.** Tick the box and say it again. One call, for B5678, arriving with `EndOfTurn`.
- **Pause too long** (a second and a half) and Flux ends your turn after "A1234". The call goes out
  either way then, and talking again is a barge-in.

## What we saw (checked live 2026-11-16)

Flux `flux-general-en` v2, `gpt-4o-mini`, `flux-wes-en`, a macOS `say` clip streamed at real time
with a 0.7 s pause after "A1234":

- **Off, answered at once** (what this page does): `FunctionCallRequest` for A1234 arrived about
  0.6 s into the pause, before `EndOfTurn`. The answer went back, the turn resumed, and no
  `FunctionCallCancelled` came (2 of 2). The wrong order was cancelled.
- **Off, answer held 1.5 s:** `FunctionCallCancelled` named the A1234 call alongside the next
  `UserStartedSpeaking`, 0.7 to 0.9 s after the request (3 of 3). The `History` message for that
  call then shows `"response":"{\"status\":\"CANCELLED\"}"`.
- **On:** a `LatencyReport` with `ttt_tool_latency` shows the LLM still made the A1234 call, but no
  request reached the client. One `FunctionCallRequest`, for B5678, came in the same millisecond as
  `EndOfTurn` (4 of 4).
- **Nova-3:** the agent split the line into separate turns and made no early call, so the page
  offers Flux only.
- The server echoes each `FunctionCallResponse` back to the client.

## Why this page never shows FunctionCallCancelled

The shared agent page answers every function call the moment it arrives. In our runs a call that
was already answered was never announced as cancelled: `FunctionCallCancelled` only came while the
answer was still pending. So on this page the visible difference is when the call arrives and which
order gets cancelled. The panel still marks a call if `FunctionCallCancelled` ever names it.

## Docs mismatches

- The [Function Call Cancelled](https://developers.deepgram.com/docs/voice-agent-function-call-cancelled)
  page says the message covers every call the server already sent you. It does not say that a call
  you already answered is left out: live, an answered call got no `FunctionCallCancelled`, so a fast
  function that changes something has no way to learn it ran on a resumed turn.
- The [speculative replies](https://developers.deepgram.com/docs/voice-agent-speculative-replies)
  page says every listen provider replies early. On Nova-3 the agent made no early call in our run.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-defer-until-eot pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: Settings, the `cancel_order` function, the toggle, and the cancelled-orders panel. The comment at the top records what was checked live |
| [`styles.css`](styles.css) | The panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
