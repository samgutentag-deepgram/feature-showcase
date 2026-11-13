# Flux TTS turns

**Every turn, accounted for.** A voice agent speaks in turns. Press Speak and the page sends the reply one sentence per turn on a single Flux socket. Each turn comes back with its own speech_id, how long the audio ran, and how many characters were billed.

- **Live:** https://dg-devrel-flux-tts-turns.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/flux-tts/state

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-tts-turns pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh flux-tts-turns`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/tts/TtsShell.tsx`](../../shared/tts/TtsShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Turns on the Flux socket, and what the server says about each. Verified live 2026-11-12 on wss
/v2/speak with flux-wes-en, linear16 at 24 kHz: each Speak + Flush is a turn of its own,
answered SpeechStarted {speech_id}, Flushed, the audio, then SpeechMetadata {speech_id,
audio_duration_ms, input_character_count, billable_character_count}. A new turn gets a new
speech_id; the voice keeps its tone across turns on one socket (docs/flux-tts/context).
Flux only. flux-wes-en is the default: the steadiest of 14 English Flux voices on 2026-11-11.
```
