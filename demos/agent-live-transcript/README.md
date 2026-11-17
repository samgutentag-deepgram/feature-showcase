# Agent live transcript

**Read the call as it happens.** Talk to the agent and every `ConversationText` message lands in a chat with the time it arrived. The agent's text comes one sentence at a time, as each sentence starts to play. Your text comes once, when you stop talking. Ask for a long answer, then talk over it: the line that was playing still shows in full, and the rest of the answer never arrives.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-live-transcript/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-conversation-text

## What to try

- **Pieces.** Leave "Long answers" ticked, press **Start talking**, and say "Tell me about the history of Paris." The agent's reply builds up in one bubble, one sentence per message, each with its time and how far into the reply's audio it arrived.
- **Interrupt it.** A few seconds into that answer, say "Stop. What is two plus two?" The reply gets an **Interrupted** flag and a note on when you cut in. The sentence that was playing is there in full; the sentences after it never arrive.
- **Flux against Nova-3.** On Flux your line arrives with `EndOfTurn` and carries an empty `words` field. Nova-3 can split "Stop. What is two plus two?" into two lines.

Times in the panel count from the first agent audio of the call (the greeting). The shell's run log below shows the same lines plus every other event; the Response card shows the last `ConversationText` raw.

## What the API actually sends

Checked live on 2026-11-16 with synthetic user speech, on Flux and Nova-3. The [docs page](https://developers.deepgram.com/docs/voice-agent-conversation-text) says a message comes "every time the agent speaks something"; here is what that means in practice:

- **The assistant's text comes one sentence per message**, each landing with the first audio chunk of that sentence, not when its audio ends. A two-sentence reply came as two messages 2.0 s apart. The greeting (two short sentences) came as one.
- **The user's text comes once per turn, after you stop.** No interim user text arrived on either model. On Flux it came with `EndOfTurn`, 1.2 to 3.1 s after the turn's first `UserStartedSpeaking`.
- **On barge-in**, `UserStartedSpeaking` and `AgentAudioDone` came together after 3.35 s of reply audio. The sentence that was playing had already been sent in full, and no `ConversationText` came for the rest of the planned answer.
- Flux user lines carry `"words": []`, which the docs do not list.

The panel marks a reply interrupted when `UserStartedSpeaking` arrives before its `AgentAudioDone` (the server stopped sending it), or after `AgentAudioDone` while its audio is still playing on the page (only playback was cut).

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ...}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio (24 kHz PCM), ConversationText, events ═
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message exactly as sent. There is nothing to turn on:
  `ConversationText` always comes.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-live-transcript pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo and its chat panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The chat panel |
| [`agent-live-transcript.test.ts`](agent-live-transcript.test.ts) | The grouping, fed the message order of a live barge-in probe |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
