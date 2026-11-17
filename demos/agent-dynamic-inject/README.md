# Dynamic InjectAgentMessage

**Let the agent word its own filler.** Your app is busy and the line is quiet. Press Agent words it and Think Live writes a stalling line from the conversation so far. Press Fixed line to hear the line you wrote. Sometimes there is no line to write: the server sends `DYNAMIC_FILLER_UNAVAILABLE` and says nothing, and the panel counts how often.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-dynamic-inject/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-inject-agent-message
- **Fixed lines only:** [`inject-agent-message`](../inject-agent-message/) covers `default`, `queue` and `interrupt` with a message you write.

## What to try

- **Agent words it** sends `{"type": "InjectAgentMessage", "behavior": "queue", "is_dynamic": true}`. The line comes back as `ConversationText` with `conversational_behavior: "filler"`.
- **Fixed line** sends the same with `"message": "One moment while I check that."`. It is always spoken.
- **Press Agent words it twice before you say anything.** The second ask usually comes back `Warning DYNAMIC_FILLER_UNAVAILABLE`. Then ask about an order, and try again: after the first turn it almost always works.
- **The fallback switch** (on by default) sends the fixed line whenever the warning arrives, which is what your app should do too.

## What we measured

Probed 2026-11-16, gpt-4o-mini thinking, Think Live with backchannels and presence checks at 0, caller turns sent as `InjectUserMessage` text, 16 calls, 71 asks with the agent quiet:

| When | Worded a line | `DYNAMIC_FILLER_UNAVAILABLE` |
|---|---|---|
| First ask of the call | 14 of 15 | 1 (sent during the greeting) |
| Asking again before the caller spoke | 4 of 18 | 14 of 18 |
| After the caller's first turn | 35 of 38 | 3 (each the first ask right after a reply; the next ask worked) |

- The warning reads `Ignored InjectAgentMessage because no dynamic filler could be produced.` and arrives about 0.1 s after the ask. A worded line took 1 to 4 s.
- Without `agent.think_live` the code is the same and the description says `is_dynamic needs agent.think_live`.
- Mid-reply, `behavior: "default"` came back `Warning INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH` (`Ignored InjectAgentMessage because the agent is already in the middle of a reply.`) 3 of 3 times. `queue` was spoken after the reply once and came back `DYNAMIC_FILLER_UNAVAILABLE` once. `interrupt` cut the reply and spoke the filler 0.2 s later.
- The lines narrate a lookup ("I'm pulling it up.", "Let me check the current status of your order."), so send them while your app is really waiting on something.
- The docs name the refusal `InjectionRefused`; the server sent a `Warning` instead.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think_live": {...}, ...}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  {"type": "InjectAgentMessage", "behavior": "queue", "is_dynamic": true}  ─▶
  │  ◀═══ ConversationText filler and its audio, or Warning DYNAMIC_FILLER_UNAVAILABLE
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message and both inject messages exactly as sent.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-dynamic-inject pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: agent, actions, the side-by-side panel and the fallback. The comment at the top records what was probed live |
| [`styles.css`](styles.css) | The panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
