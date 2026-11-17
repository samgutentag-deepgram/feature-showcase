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

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
