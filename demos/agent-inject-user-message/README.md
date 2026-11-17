# Type to a voice agent

**Type to a voice agent mid-call.** Start the call and ask the agent something out loud. Then type a question in the box: the page sends it as `InjectUserMessage`, the agent answers it by voice, and the transcript shows your typed line as your turn, tagged **Typed**. Type while the agent is still talking and it stops to answer.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-inject-user-message/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-inject-user-message

This is the caller's side. To put words in the agent's mouth instead, see
[inject-agent-message](../inject-agent-message/).

## What to try

- **Speak, then type.** Press **Start talking**, ask "What is the oldest painting here?", let it answer, then type "What time do you close today?" and press Enter. The agent answers out loud, and the panel lists what came back: `UserStartedSpeaking`, your text as `ConversationText` with `role: "user"`, `EndOfTurn` with `trigger: "manual"` on Flux, then the agent's reply.
- **Type over it.** Ask for a story about the oldest painting, and while it is telling it, type a question. No error or warning comes back: the server treats the typed line like you talking over it, ends the story (`AgentAudioDone`), and answers the question.
- **Flux against Nova-3.** Same messages on both, except `EndOfTurn` only arrives on Flux.

Headphones help: without them the agent can hear itself through your speakers.

## What the server sends back

Probed live on 2026-11-16 with `{"type": "InjectUserMessage", "content": "What time do you close today?"}`:

| When it is sent | What came back, in order |
|---|---|
| Agent quiet | `UserStartedSpeaking`, `ConversationText` (role user, the typed text verbatim), `History`, `EndOfTurn` `{"trigger": "manual"}` (Flux only), then the agent's reply about 0.6 s later |
| Agent mid-reply or mid-greeting | `UserStartedSpeaking`, `AgentAudioDone` (the old reply stops), the typed `ConversationText`, `History`, `EndOfTurn` (Flux only), then a reply to the typed line. No `Error` or `Warning` |

That second row is the difference from `InjectAgentMessage`, which the server refuses mid-reply with
the Warning `INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH`. The
[docs page](https://developers.deepgram.com/docs/voice-agent-inject-user-message) shows only the
request, so neither what comes back nor the mid-reply behavior is documented there.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ...}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  {"type": "InjectUserMessage", "content": "..."}  ──────▶  (the text box)
  │  ◀═══ agent audio (24 kHz PCM) and events ════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The text box is the demo's own `Panel` in `index.tsx`. It fires a hidden action, so the Request card
  still shows the exact message, with the typed text as `content`. The page drops queued agent audio
  on `UserStartedSpeaking`, so a typed line cuts the agent off at once.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-inject-user-message pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: agent, copy, and the text box panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The text box and the typed-turn log |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

TODO
