# Agent errors and warnings

**Break the agent on purpose.** Pick one of five cases and press Start talking. Two send a bad Settings message: the agent answers with an `Error` and closes the socket. Three get a `Warning` and the call carries on. The panel lists each code with its description and says whether the socket stayed open.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-errors-warnings/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-errors-warnings

## What to try

No need to talk in any case.

| Case | What is sent | What came back in testing | Socket |
|---|---|---|---|
| Unknown think model | `agent.think.provider.model: "gpt-0-does-not-exist"` | `Error` `INVALID_SETTINGS` | Closed by the server |
| Malformed Settings | `agent.greeting: 42` | `Error` `UNPARSABLE_CLIENT_MESSAGE` ("Check the agent.greeting field") | Closed by the server |
| Think-Fast prompt note | `agent.think.provider: { type: "deepgram", model: "think-fast" }` | `Warning` `VOICE_PROMPT_ADDED`, then `SettingsApplied` | Open |
| Dead think provider | `agent.think` as a list, `gpt-4.1-nano` then `gpt-4o-mini`; press **Ask a question** | Three `Warning` `THINK_REQUEST_FAILED` (upstream 404), then the fallback answers | Open |
| Inject over the agent | `agent.think` as a list that works, `gpt-4o-mini` then Anthropic `claude-haiku-4-5`. Press **Ask for a story, then inject**: `InjectUserMessage`, then `InjectAgentMessage` with `behavior: "default"` once the story's audio starts | `Warning` `INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH`; the story goes on | Open |

None of the cases needs a provider key or an endpoint of our own: every model is one Deepgram hosts.

**Left out.** Mid-call messages can end a session too. An unknown message type or a text frame that is not JSON gave `Error` `UNPARSABLE_CLIENT_MESSAGE`, and a second `Settings` gave `SETTINGS_ALREADY_APPLIED`, each closing the socket at once. They are not on the page because the live checks cannot expect an Error from a mid-call message yet.

**Docs differences.** `VOICE_PROMPT_ADDED` is not in the docs' Warning table.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think": ...}}
  │  ◀═══ Error (then close) or Warning (call goes on) ═══════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message exactly as sent, and the mid-call messages for
  the two cases that have them. The panel reads every server message of the run.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-errors-warnings pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the five cases, the panel, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The case picker and panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

Verified live 2026-11-16: ONLY=agent-errors-warnings pnpm verify:live passed. With Flux and Nova-3 listening, the unknown think model came back Error INVALID_SETTINGS, greeting 42 came back Error UNPARSABLE_CLIENT_MESSAGE, think-fast came back SettingsApplied with Warning VOICE_PROMPT_ADDED, the fallback and inject Settings applied, and each mid-call message was answered (Ask a question with a Warning, Ask for a story and Inject while it talks with ConversationText or a Warning); the prompt.md Settings worked with a granted token.

The per-case probes behind the table above are recorded at the top of [`index.tsx`](index.tsx).
