# Agent History events

**Keep the transcript as you go.** With `flags.history` on, the Voice Agent API sends a `History`
message for every line said and every function it called, the moment it happens. The page builds a
log from those messages alone. Turn the flag off and have the same conversation: the agent talks
just the same, and the log stays empty.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-history-events/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-history

## What to try

- **Flag on.** Press **Start talking** and say "What time does the Portland store close today?".
  The log fills with the greeting, your line, a `get_store_hours` call with its response, and the
  answer. Each one also shows in the timeline as a `History` event.
- **Flag off.** Untick the box and ask again. The conversation and the function call are the same;
  no `History` message arrives, so the log stays empty.

## How this differs from context history

[`context-history`](../context-history/) sends past turns **in**: `agent.context.messages` in the
Settings message, so the agent starts the call already knowing the caller. This demo is about what
comes **out**: the `History` messages the server streams during the call, and the top-level
`flags.history` switch that turns them on or off. The two fit together: save the `History` messages
from one call, send them back in `agent.context.messages` on the next.

## What a History message carries (checked live 2026-11-16)

- One per `ConversationText`, in the same millisecond, greeting included, with the same fields:
  `{"type":"History","role":"user","content":"...","conversational_behavior":"default"}` (Flux user
  lines also carry `"words":[]`).
- One per function call, right after the `FunctionCallResponse`:
  `{"type":"History","function_calls":[{"id","name","client_side","arguments","response"}]}`.
- Turns sent in `agent.context.messages` are not replayed as `History` messages.
- `flags.history: false` stops every `History` message. Nothing else changes: `ConversationText`,
  function calls, and `agent.context` all still work.
- Left out, `flags.history` defaults to on.

## Docs mismatches

- The [History docs](https://developers.deepgram.com/docs/voice-agent-history) put the switch at
  `settings.flags.history`. Sent that way, the server answers `Error` `UNPARSABLE_CLIENT_MESSAGE`.
  It works at the top level of the Settings message: `{"type":"Settings","flags":{"history":false},...}`.
- The page only documents `History` as an input (`agent.context.messages`). It does not describe
  the `History` messages the server sends during a call, or that the flag only turns those off
  (`agent.context` still works with the flag off).
- In the function-call `History` message, `client_side` is `false` for a function the page
  answered, though the `FunctionCallRequest` for the same call said `client_side: true`.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-history-events pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: Settings, the `get_store_hours` function, the toggle, and the History log panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The History log panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
