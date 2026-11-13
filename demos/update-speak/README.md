# UpdateSpeak

**Change its voice mid-call.** The agent starts as Alexis, a Flux voice. Press another voice and it answers in that voice straight away, Flux or Aura-2, without reconnecting.

- **Live:** https://dg-devrel-update-speak.fly.dev
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-update-speak

## What to try

- **Swap it.** Press **Start talking**, ask for a fun fact, then press a voice button and ask for another. `SpeakUpdated` lands in the timeline and the answer comes back in the new voice.
- **Aura-2 to Flux.** Flux voices take `version: "v2"` in the provider. With Flux voices the new voice starts on the agent's next turn.

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
FEATURE=update-speak pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh update-speak`.

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
UpdateSpeak: change the agent's voice mid-call. Verified live 2026-11-11 on the Agent API, both
listen models: UpdateSpeak to aura-2-orion-en, aura-2-luna-en, flux-kit-en and flux-alexis-en
each came back SpeakUpdated in about 0.1 s, and the next line was spoken in the new voice. A voice
that does not exist also comes back SpeakUpdated, then Error FAILED_TO_SPEAK and the session ends,
so pick from a known list.
```
