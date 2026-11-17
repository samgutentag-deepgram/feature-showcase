# Agent state indicator

**Show what the agent is doing.** Ask the agent a question and watch the light move from listening to you speaking, to thinking, to the agent speaking. Every change comes from a message Deepgram sent or from the first audio of a reply, and the log under the light shows which.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-state-indicator/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-outputs

## What to try

- **One question.** Press **Start talking**, let the greeting finish, then ask "What time does the library open on Saturday?" The light goes Listening, User speaking, Thinking, Agent speaking, then back to Listening, and each step names the message that moved it.
- **Talk over it.** While the agent answers, say "Actually, what about Sunday?" `UserStartedSpeaking` flips the light back to User speaking and the page drops the queued audio.
- **Flux against Nova-3.** On Flux, `EndOfTurn` starts Thinking. On Nova-3 it never arrives, so the user's `ConversationText` starts it instead, at the same moment in our tests.

Headphones help: without them the agent can hear itself through your speakers.

## Which messages drive which state

| State | Starts on |
|---|---|
| Listening | `SettingsApplied`, or after `AgentAudioDone` once local playback runs out |
| User speaking | `UserStartedSpeaking` |
| Thinking | `EndOfTurn` (Flux) or `ConversationText` with `role: "user"`, whichever comes first |
| Agent speaking | The first audio chunk of a reply, held until `AgentAudioDone` has arrived and playback is empty |

`AgentAudioDone` means the server has sent the last chunk, not that the visitor has heard it. The
page can hold several seconds of queued audio, so the light waits for playback to finish too.

## Docs and the API disagree

The [outputs page](https://developers.deepgram.com/docs/voice-agent-outputs) lists `AgentThinking`,
and the [API reference](https://developers.deepgram.com/reference/voice-agent/voice-agent) lists
`AgentThinking` and `AgentStartedSpeaking`. In live tests on 2026-11-16 neither arrived, on Flux or on
Nova-3. `EndOfTurn` does arrive on Flux, in the same millisecond as the user's `ConversationText`, but
no docs page describes it. This demo builds the light only from what arrived, and the panel says,
per run, which of those messages showed up.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"listen": {...}, ...}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio (24 kHz PCM) and events ════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The panel is the demo's own (`Panel` in `index.tsx`): it reads every server message of the run,
  the time each reply's audio started, and whether audio is still playing.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-state-indicator pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: agent, copy, and the state panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The four lights |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
