# Think Live

**It says mhmm.** Think Live adds a Deepgram model next to your LLM that handles the floor: a quick "mhmm" while you talk, and a check-in when you go quiet. Read the long line slowly, then say nothing. Turn it off and hear the dead air.

- **Live:** https://dg-devrel-think-live.fly.dev
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-think-live

## What to try

- **Backchannels.** Press **Start talking** and read the suggested line slowly. With Flux as the listen model the agent drops in a short "sure" or "mhmm" while you are still talking. It shows as a `backchannel` aside in the transcript.
- **Presence checks.** Then say nothing. About 8 seconds later the agent asks once if you are still there. Tagged `presence_check`.
- **Without it.** Untick Think Live and do it again. Silence stays silent.

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
FEATURE=think-live pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh think-live`.

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
Think Live: a Deepgram model that runs next to the reasoning LLM and handles the floor.
Verified live 2026-11-11 on the Agent API with a 30-second-style key session, gpt-4o-mini thinking:
  Silence after the greeting, Think Live on: ConversationText presence_check "Are you still on
  the line?" about 9 s in, then "Are you still there?". Both listen models. Off: nothing.
  A 12 s caller turn (Aura-2 audio), sensitivity 0.9, Flux listening: ConversationText
  backchannel "sure" 1.7 s into the turn, while the caller was still talking. Nova-3 listening:
  no backchannel in the same test, presence checks only.
```
