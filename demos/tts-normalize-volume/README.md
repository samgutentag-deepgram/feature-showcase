# Text-to-speech volume normalization

**Every voice at the same volume.** Press Speak and the same line plays in five Flux voices, back to back. Turn normalization off and some voices come out quieter than others, and the same voice can change level from one call to the next. Turn it on and they all land within a dB or two. The page measures each one as it plays. Flux TTS only.

- **Live:** https://dg-devrel-demos.fly.dev/demos/tts-normalize-volume/
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/reference/speak/v-2/audio/generate

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-normalize-volume pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-normalize-volume`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: voices, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/tts/TtsShell.tsx`](../../shared/tts/TtsShell.tsx). This demo
is the first to use its lineup mode (`lineup: true`, [`shared/tts/lineup.ts`](../../shared/tts/lineup.ts)):
one press speaks the line in every voice back to back and measures each one
([`shared/tts/loudness.ts`](../../shared/tts/loudness.ts)).

## Verified live

From the top of `index.tsx`:

```text
Loudness normalization across voices. Verified live 2026-11-13 on POST /v2/speak, linear16 at
24 kHz, container=none:
  normalize_volume=true and =false are a 200; =bogus is a 400 "expected a boolean". The docs
  say it defaults to true, and leaving it out measured the same as true on drew and hannah,
  so the page always sends it, and the card says which one ran.
  Same line, five voices (wes, drew, hannah, marcus, brittany), 3 calls each, speech level as
  RMS of 20 ms windows above -50 dBFS:
    false: -19.7 to -15.6 dBFS, a 4.1 dB spread. drew ran up to 3.5 dB under the rest, with peaks
           down to -4.4 dBFS; marcus drifted 0.9 dB and brittany 1.1 dB between calls.
    true:  -17.5 to -16.0 dBFS, a 1.6 dB spread, every peak at -1.5 dBFS.
  A second line over seven voices gave 4.7 dB off and 1.4 dB on.
Flux only: /v1/speak takes the param on aura-2-thalia-en with a 200, but it ignores unknown
params, so that proves nothing; the docs list it for /v2/speak.
marcus and brittany are in the lineup on purpose (cleared for use; they drift in volume between
calls), never first: flux-wes-en leads, as everywhere.
```
