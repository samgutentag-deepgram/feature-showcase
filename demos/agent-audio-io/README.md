# Agent audio formats

**Talk to the agent over a phone line.** Pick an audio format (Phone mu-law is picked first; Browser is the API default), press Start, and talk. The page shows the `audio` block of the Settings message, the bytes per second going each way, and plays the agent's reply in that format. Phone audio sounds narrower: at 8 kHz nothing above 4 kHz survives.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-audio-io/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-media-inputs-outputs

## What to try

- **Phone, then browser.** Run it once as **Phone mu-law** and once as **Browser**, and say "Repeat after me: she sells seashells by the seashore." On the phone format nothing above 4 kHz comes back, and that is where the hiss of an s sits.
- **Watch the bars.** Browser sends 32,000 bytes a second and gets 48,000 back. Either phone format is 8,000 each way.
- **Flux against Nova-3.** Both listen models understand mu-law and A-law at 8 kHz.

Headphones help: without them the agent can hear itself through your speakers.

## The formats

| Format | `audio.input` | `audio.output` | Mic to agent | Agent to you |
|---|---|---|---|---|
| Browser (default) | `linear16`, 16000 | `linear16`, 24000 | 32,000 B/s | 48,000 B/s |
| Wideband | `linear16`, 16000 | `linear16`, 16000 | 32,000 B/s | 32,000 B/s |
| Phone mu-law | `mulaw`, 8000 | `mulaw`, 8000 | 8,000 B/s | 8,000 B/s |
| Phone A-law | `alaw`, 8000 | `alaw`, 8000 | 8,000 B/s | 8,000 B/s |

Every output sends `container: "none"`. The mic is captured at 16 kHz; for 8 kHz formats the page
averages each pair of samples and encodes them to G.711 (`shared/agent/codec.ts`), and it decodes
the agent's G.711 back to samples to play.

## Docs and the API disagree

The [TTS models page](https://developers.deepgram.com/docs/voice-agent-tts-models#audio-output-formats)
says a `container` such as `wav` with a Flux voice returns `INVALID_SETTINGS`. Live on 2026-11-16 it
did not: the agent sent a Warning, `SPEAK_STREAMING_FORMAT_UNSUPPORTED`, applied the settings, and
then sent each reply whole as one WAV file (a `RIFF` header, then 24 kHz PCM) instead of streaming
it. `mp3` output with a Flux voice did fail with `INVALID_SETTINGS`, as documented.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", "audio": {"input": {...}, "output": {...}}, "agent": {...}}
  │  ═══ mic audio in the input format ═══════════════════════▶
  │  ◀═══ agent audio in the output format, and events ════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The panel is the demo's own (`Panel` in `index.tsx`). Its byte rates come from the format: raw
  audio is the sample rate times the bytes in one sample, which is what came back live.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-audio-io pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: formats, agent, copy, and the panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The audio block and the byte-rate bars |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

From the top of `index.tsx`:

```text
Agent audio formats: the same agent over browser audio (linear16) and phone audio (mulaw or alaw at
8 kHz), set by the Settings audio block. Checked live 2026-11-16 with a one-off script per format:
Settings, a greeting, then a 2.6 s spoken question encoded with shared/agent/codec.ts the way the
page encodes the mic. Every combo below came back SettingsApplied, the agent heard the question
("What is the capital of France?") and answered, and the reply bytes decoded at the Settings rate:
  linear16 16 kHz in, 24 kHz out: 48,000 bytes per second of reply audio, greeting 4.2 s.
  linear16 16 kHz in, 16 kHz out: 32,000 B/s.   linear16 8 kHz in, 16 kHz out: 32,000 B/s.
  mulaw 8 kHz both ways: 8,000 B/s, greeting 4.6 s.   alaw 8 kHz both ways: 8,000 B/s.
Flux and Nova-3 listen both understood mulaw and alaw 8 kHz input. Energy above 4 kHz: 1.5 to 3.8%
of each 24 kHz reply, 0.5 to 1.8% at 16 kHz, none at 8 kHz (it cannot carry anything above 4 kHz).
Rejected or changed: output mp3 with a Flux voice -> Error INVALID_SETTINGS. container wav with a
Flux voice is NOT rejected, though the docs say INVALID_SETTINGS: a Warning
SPEAK_STREAMING_FORMAT_UNSUPPORTED arrives, then each reply comes whole as one WAV file ("RIFF" and
a 44-byte header, then 48,000 B/s). The page plays raw audio only, so it offers container none.
Verified live 2026-11-16: verify:live sent all four Settings audio blocks (mulaw 8k, alaw 8k, linear16 16k/16k, linear16 16k/24k) with Flux and Nova-3 listen, all 8 came back SettingsApplied; docs links resolved.
```
