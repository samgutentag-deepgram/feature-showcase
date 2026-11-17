# Agent greeting

**Let the agent say hello first.** Set `agent.greeting` and the agent opens the call with that line
before the caller says a word. Pick or type a greeting, press Start, and stay quiet: the greeting
comes back as the first `ConversationText`, right after `SettingsApplied`. Turn it off and the agent
waits for you.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-greeting/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/configure-voice-agent

## What to try

- **Stay quiet.** Leave **Front desk** picked, press **Start talking**, and say nothing. The agent
  speaks the greeting, and the "First moments of the call" panel lists `SettingsApplied`, the first
  agent audio, and the marked `ConversationText` (role `assistant`) carrying the greeting, all before you talk.
- **Your own line.** Type any greeting (up to 200 characters) or pick **Short** or **Disclosure**.
  The Request card updates, and the agent says exactly that line.
- **No greeting.** Untick **Send a greeting**. `greeting` drops out of the Settings message, and
  after `SettingsApplied` the agent stays silent until you talk.

Headphones help: without them the agent can hear itself through your speakers. Pick Flux or Nova-3
as the agent's listen model with the toggle; Flux is the default.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"greeting": "...", ...}}
  │  ◀═══ Welcome, SettingsApplied, greeting audio, ConversationText (assistant) ═══
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message exactly as sent. The panel under the controls
  lists the call's first messages in order, up to the moment you start talking.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-greeting pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: greeting presets, the first-moments panel, controls, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The greeting input and panel spacing |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
agent.greeting: the agent speaks first. Checked live 2026-11-16 on the Agent API with no user
audio at all, Flux and Nova-3 listening:
  Welcome, SettingsApplied, then the first agent audio frame and, in the same millisecond,
  ConversationText role assistant with the greeting word for word (60 to 150 ms after
  SettingsApplied), then History, then AgentAudioDone 1.3 to 1.9 s later. Leave greeting out and
  nothing follows SettingsApplied: the agent stays silent until the caller talks.
Verified live 2026-11-16: ONLY=agent-greeting pnpm verify:live passed; all four Settings (three greetings and no greeting) came back SettingsApplied on Flux and Nova-3, and a Flux call with flux-wes-en returned Welcome, SettingsApplied, audio, ConversationText assistant "Hey there! What can I do for you?", History, AgentAudioDone.
```
