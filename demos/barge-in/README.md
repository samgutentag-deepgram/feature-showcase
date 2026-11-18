# Barge-in

**Interrupt it.** The agent opens with a long sales pitch. Talk over it. Deepgram sends UserStartedSpeaking the moment you start, and the page drops the audio it was about to play. Turn that off and hear what happens without it.

- **Live:** https://dg-devrel-demos.fly.dev/demos/barge-in/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent

## What to try

- **Interrupt it.** Press **Start talking**, wait a second or two into the greeting, then say the suggested line. The timeline shows `UserStartedSpeaking` and how many seconds of agent audio were dropped.
- **Without the stop.** Untick the box and do it again. Same event, but the agent keeps talking for the rest of what it had queued.
- **What we saw in testing.** `UserStartedSpeaking` arrived about 0.4 s after the interruption. By then about 10 s of the 14 s greeting had already been sent, while only about 3 s had played. Deepgram detects the interruption; your app has to stop the audio.

Headphones help: without them the agent can hear itself through your speakers. Pick Flux or Nova-3
as the agent's listen model with the toggle; Flux is the default.

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
FEATURE=barge-in pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh barge-in`.

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
Barge-in: talk over the agent and it stops. Verified live 2026-11-18 on the Agent API, 8 runs
(4 Flux, 4 Nova-3 listen), with a Flux TTS caller clip sent 2.5 s after the first greeting byte:
  UserStartedSpeaking arrived 0.33 to 0.45 s (about 0.4 s) after the caller started talking.
  By then the server had sent about 10 s of the 14 s greeting, while about 3 s had played: it
  streams the greeting at about 3.5x real time, far ahead of playback.
So Deepgram detects the interruption, and the page decides what to do with the audio it is
holding. With the switch on, it drops that queued audio; off, the agent keeps talking over you.
```
