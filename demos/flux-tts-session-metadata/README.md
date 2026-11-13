# Flux TTS session totals

**One bill for the whole call.** Press Speak and the reply goes out a sentence per turn on one Flux socket. When the last turn is done, the page sends Close, and Flux answers with SessionMetadata: the total audio and billable characters for the whole session, set against the sum of the turns. Flux voices only.

- **Live:** https://dg-devrel-demos.fly.dev/demos/flux-tts-session-metadata/
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/flux-tts/server-messages

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-tts-session-metadata pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh flux-tts-session-metadata`.

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
What a whole Flux socket session cost, reported once at the end. Verified live 2026-11-13 on wss
/v2/speak, linear16 at 24 kHz, with flux-wes-en (3 and 4 turns) and flux-hannah-en (3 turns):
  after the last turn's SpeechMetadata, {"type":"Close"} -> SessionMetadata in 24-80 ms, then a
  1000 close. Its fields: type, total_audio_duration_ms, total_input_character_count,
  total_billable_character_count. Nothing else.
  wes, 3 turns of 19 + 32 + 29 chars -> {4800, 80, 80}; turns 1120 + 1600 + 2080 ms = 4800.
  wes, 4 turns with trailing spaces, 147 chars -> {7440, 147, 147}; the spaces are counted.
  hannah, 3 turns, 139 chars -> {8480, 139, 139}; turns 3840 + 2000 + 2640 ms = 8480.
  Every total matched the sum of the turns and the characters sent; input and billable were equal.
  Closing the socket without Close: no SessionMetadata. Speak + Close with no Flush: the session
  still reported, but with 2.48 s of audio where Speak + Flush + Close gave 4.4 s.
Flux only: SessionMetadata is a /v2/speak message. flux-wes-en is the default: the steadiest of 14
English Flux voices on 2026-11-11.
```
