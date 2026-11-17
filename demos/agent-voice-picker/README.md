# Agent voice picker

**Pick the voice your agent speaks with.** Choose one of 36 English Flux voices or 41 Aura-2 voices, press Start, and talk. The agent greets you by name and answers in that voice. One field in the Settings message picks it: `agent.speak.provider`.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-voice-picker/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-tts-models

## What to try

- **Flux first.** Leave it on Wes (Flux), press **Start talking**, and ask for a fun fact. The Request card shows `"version": "v2"` and `"model": "flux-wes-en"` under `speak.provider`.
- **Switch families.** Stop, press **Aura-2**, pick a voice, and start again. `version` drops out of the provider and the same question comes back in the new voice.

## Which voices

| Family | Voices | `agent.speak.provider` |
|---|---|---|
| Flux | 36, the English rows of the Flux TTS catalog (from `demos/flux-tts-voices/voices.ts`) | `{ "type": "deepgram", "version": "v2", "model": "flux-{voice}-en" }` |
| Aura-2 | 41, the English rows of the Aura-2 catalog (from `demos/aura-voice-picker/voices.ts`) | `{ "type": "deepgram", "model": "aura-2-{voice}-en" }` |

The default is `flux-wes-en`, the steadiest Flux voice across repeat calls. Every Flux voice is cleared for use. `flux-marcus-en` and `flux-brittany-en` are listed like the rest; they can drift in pitch and volume between calls.

**Third-party voices are left out.** The API also takes OpenAI, ElevenLabs, Cartesia and Amazon Polly in `agent.speak`, but those need your own key for that provider in `agent.speak.endpoint` (or `provider.credentials` for Polly), and a public page cannot hold one. See the docs link above for their Settings shapes.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"speak": {"provider": {...}}, ...}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio (24 kHz PCM) and events ════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The voice is fixed for the call. To change it mid-call, send `UpdateSpeak` (the `update-speak` demo).

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-voice-picker pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: voice lists, Settings, controls, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The voice picker's select |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: pnpm verify:live sent the Settings for flux-wes-en (version v2) and
aura-2-thalia-en with Flux and Nova-3 listening, and the prompt.md Settings with a granted token;
each came back SettingsApplied, and the docs link resolved.
```

Before that, a one-off script opened one session per voice in the lists (36 Flux, 41 Aura-2): every one came back SettingsApplied and spoke its greeting, first audio in 0.19 to 0.44 s.
