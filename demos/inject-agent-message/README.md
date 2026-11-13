# InjectAgentMessage

**Cut in on your own agent.** Ask the agent for a story. While it is telling it, press Cut in: the agent drops the story and says your line at once. Say it next waits for the story to end. The timeline shows what the server did with each one.

- **Live:** https://dg-devrel-inject-agent-message.fly.dev
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-inject-agent-message

## What to try

- **Cut in now** (`behavior: "interrupt"`). Press it mid-story. The line is spoken right away (about 0.1 s to the server's ConversationText in testing), and the page drops the story audio it had queued.
- **Say it next** (`behavior: "queue"`). Press it mid-story. The line waits until the story ends.
- **Why no default button.** `default` mid-reply is refused with a `Warning` (`INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH`), so it reads as a dead button. Send it from your own code when you only want the line said if the agent is idle.
- **What we saw in testing.** The docs name the refusal `InjectionRefused`; the server sent a `Warning` instead. `default` during the greeting was not refused, it played after the greeting.

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
FEATURE=inject-agent-message pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh inject-agent-message`.

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
InjectAgentMessage: your app puts words in the agent's mouth mid-call. Verified live 2026-11-11 on
the Agent API, both listen models, a storyteller prompt so the agent is mid-reply:
  default while the agent is mid-reply: Warning INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH, not
    spoken. (The docs name this InjectionRefused; the server sent a Warning.)
  default during the greeting: spoken after the greeting, so the greeting does not count as a reply.
  default or queue while the caller is talking: Warning INJECT_AGENT_MESSAGE_DURING_USER_SPEECH.
  queue while the agent is talking: spoken after it finishes.
  interrupt while the agent is talking: spoken at once; the server stops the old reply, and the
    page drops the audio it had queued so the cut is audible.
```
