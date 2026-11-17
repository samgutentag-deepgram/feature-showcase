# Agent reusable config

**Send an id, not the whole agent.** Store the agent block once with the Deepgram REST API and the
`Settings` message shrinks to an id. Press Start and talk: the Request card carries only the id, the
panel shows the stored prompt, models and voice it stands for, and the agent answers with them.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-reusable-config/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/reusable-agent-configurations

## What to try

- **Stored id.** Leave **Stored id** picked, press **Start talking**, and ask "Hi, who am I talking
  to?". The Request card shows `"agent": "377c136a-..."` and nothing else under `agent`. The agent
  answers as the customer service agent the stored config describes, in the Aura-2 Thalia voice.
- **Unknown id.** Pick **Unknown id** and press Start. Deepgram sends `Error` with code
  `INTERNAL_SERVER_ERROR` right after `Welcome`, as it would for a config that was deleted.

The stored config sets its own listen model (Nova-3), so this page has no listen toggle.

## How it works

```
once, from your server:
  POST /v1/projects/{project_id}/agents  {"config": "<agent block as a JSON string>"}  ->  id

every call:
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", "audio": {...}, "agent": "<id>"}
  │  ◀═══ Welcome, SettingsApplied, agent audio, ConversationText ═══
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
```

- The stored config was made once in the demo project. This page never creates, changes or deletes
  one, and the browser never reads it: the panel shows a copy taken from a server-side
  `GET /v1/projects/{project_id}/agents/{id}` on 2026-11-16.
- A stored config cannot be edited (only its metadata can). To change the agent, create a new
  config and send the new id.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-reusable-config pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the stored id, the unknown id, the stored-config panel, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | Panel spacing |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Reusable agent configurations: the agent block is stored once with the REST API and Settings
carries only its id. Checked live 2026-11-16 on the Agent API:
  GET /v1/projects/{project_id}/agents/377c136a-... returned the stored config below (as a JSON
  string in "config", metadata name customer-service-agent). Settings with "agent": that id came
  back Welcome, SettingsApplied; an InjectUserMessage then got ConversationText assistant "You're
  speaking with a customer service agent here to assist you." and AgentAudioDone 2.2 s in.
  An unknown id came back Error INTERNAL_SERVER_ERROR "Internal Server Error resolving agent ID."
  right after Welcome. This page never creates, changes or deletes a stored config.
Verified live 2026-11-16: ONLY=agent-reusable-config pnpm verify:live passed; Settings with the stored id came back SettingsApplied and the unknown id came back Error INTERNAL_SERVER_ERROR, as expected; a probe call with the stored id answered an InjectUserMessage with ConversationText assistant "You're speaking with a customer service agent here to assist you." and AgentAudioDone.
```
