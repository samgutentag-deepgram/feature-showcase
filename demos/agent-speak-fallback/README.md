# Speak fallback

**Keep talking when a voice fails.** Give `agent.speak` a list of voices and the agent falls back down it when one fails. Break the first voice and press Start: Deepgram sends three `SPEAK_REQUEST_FAILED` warnings and the second voice greets you, with the timing laid out in a panel.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-speak-fallback/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-tts-models (section "Using multiple TTS providers")

## What to try

- **Break it.** Tick **Break the first voice** with Flux first, press **Start talking**, and listen. The timeline shows three `Warning SPEAK_REQUEST_FAILED` right after `SettingsApplied`, and Thalia (Aura-2) greets you instead of Wes (Flux). The panel crosses out the broken id and marks the voice that spoke.
- **Measure the cost.** Run once broken with Flux first, then once unbroken with Aura-2 first. The Added delay column compares the two runs where Thalia spoke. Expect tens of milliseconds at most.
- **Flip the order.** Pick Aura-2 first and break it: Wes (Flux) takes over.

## What the API actually sends

Checked live on 2026-11-16:

- **Breaking the first voice.** A voice id that does not exist (`flux-nil-en` with `version: "v2"`, or `aura-2-nil-en`) is still accepted at `Settings`. Each attempt gets a 400 ("No such model/version combination found"), so three `SPEAK_REQUEST_FAILED` warnings arrive within about 1 to 45 ms of `SettingsApplied`, then the next voice speaks. No secret and no outside endpoint.
- **A host that does not resolve is refused up front.** An `open_ai` provider with `endpoint.url` at `https://example.invalid/...` fails `Settings` with `INVALID_SETTINGS` ("Failed to resolve endpoint"), and a Flux voice with any `speak.endpoint` is `INVALID_SETTINGS` too. Neither reaches the fallback.
- **Timings,** `SettingsApplied` to the greeting's first audio, three runs each: Flux Wes alone 153 to 191 ms, Aura-2 Thalia alone 61 to 72 ms, broken Flux then Thalia 65 to 80 ms, broken Aura-2 then Wes 162 to 197 ms. The voice that ends up speaking sets the time; the failed attempts add little.
- **The fallback sticks.** The [docs](https://developers.deepgram.com/docs/voice-agent-tts-models#how-fallback-works) say each new utterance starts again from the first provider. Live, after the greeting fell back, a later `InjectAgentMessage` line and an LLM reply were both spoken by the fallback with no new warnings.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"speak": [{...}, {...}], ...}}
  │  ◀═══ Warning SPEAK_REQUEST_FAILED x3, then the fallback's audio ═══
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message exactly as sent. The timeline shows every event
  with its time; the panel reads the same messages to say which voice spoke.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-speak-fallback pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the speak chain, controls, panel, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: ONLY=agent-speak-fallback pnpm verify:live passed. All four Settings variants (Flux or Aura-2 first, broken or not) came back SettingsApplied on Flux and Nova-3 listening, each broken one also got Warning SPEAK_REQUEST_FAILED, and the docs link resolved.
```
