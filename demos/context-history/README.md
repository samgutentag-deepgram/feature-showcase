# Context history

**Pick up where you left off.** Send the earlier conversation in the Settings message and the agent starts the call already knowing you. Ask it about "my order" with the history on, then off.

- **Live:** https://dg-devrel-context-history.fly.dev
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-conversation-context

## What to try

- **With history.** Press **Start talking** and ask about "my order". The agent answers with the order number, the arrival day and the side-gate note from the earlier turns.
- **Without it.** Untick the box and ask again. The agent asks who you are.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"greeting": "...", ...}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio (24 kHz PCM) and events ════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message exactly as sent. The timeline shows every event
  with its time.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=context-history pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh context-history`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Context history: start a session that already knows the caller. Verified live 2026-11-11 on the
Agent API, gpt-4o-mini thinking, both listen models: with agent.context.messages holding a prior
exchange (name Priya, order 4417), "What is my name and order number?" got "Your name is Priya
and your order number is 4417." Without the history the agent has nothing to go on.
```
