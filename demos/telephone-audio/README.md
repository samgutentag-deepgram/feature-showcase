# Telephone audio

**Does it sound like a phone call?** Press Speak, then pick a quality any time: the line starts over in that format. Lowest is a phone line (mu-law at 8 kHz, what a call center or Twilio stream carries); Highest is 48 kHz. Listen, and watch the spectrum: the phone line stops at 4 kHz.

- **Live:** https://dg-devrel-telephone-audio.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-media-output-settings

## What to try

- **Both settings.** Press **Speak** on **Phone line**, then switch to **Full quality** and press it again. **Replay** each run to compare by ear.
- **A tongue twister.** The seashells line is full of "s" sounds, which live above 4 kHz and are the first thing a phone line loses.
- **A voice agent prompt.** "Please say or enter your account number" is what an IVR actually says, at the quality it actually ships.

Lines to try sit under the text box. Your own text works too, up to 400 characters.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  POST /v1/speak?model=aura-2-thalia-en&encoding=mulaw&sample_rate=8000&container=none
  │  body {"text": "..."}  ──────────────────────────────▶
  │  ◀═══ audio, streamed in chunks ══════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser.
- `container=none` audio is played chunk by chunk as it arrives; anything else is decoded once the
  whole file is in. Mu-law is decoded in the page.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=telephone-audio pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh telephone-audio`.

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
Phone line to studio quality. Verified live 2026-11-11 on POST /v2/speak with flux-cole-en and
flux-wes-en (and 2026-11-10 on /v1/speak with aura-2-thalia-en), with a 30-second token:
  encoding=mulaw&sample_rate=8000&container=none     200 audio/mulaw;rate=8000, 1 byte a sample
  encoding=linear16&sample_rate=24000&container=none 200, 2 bytes a sample at 3x the rate
48 kHz linear16 is checked the same way by pnpm verify:live, for every voice.
The 8 kHz version is what a phone call carries: nothing above 4 kHz, which the spectrum shows.
Picking a button stops the line and speaks it again in that format.
Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
spread (0.08 s) of 14 Flux voices tried.
```
