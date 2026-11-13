# Text-to-speech sample rate

**How many kilohertz do you need?** Press Speak, then pick a sample rate any time: the line starts over at that rate, still 16-bit linear PCM. Listen for the hiss in "s" sounds, and compare the size on the last two runs. Each rate keeps detail up to half its value, and bytes grow with it: 16,000 a second at 8 kHz, 96,000 at 48 kHz. The spectrum stops at 12 kHz, so 24 and 48 look alike there; the difference is in your ear and the file size.

- **Live:** https://dg-devrel-demos.fly.dev/demos/tts-sample-rate/
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-sample-rate

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-sample-rate pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-sample-rate`.

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
Sample rate for linear16. Verified live 2026-11-13 with an API key, encoding=linear16,
container=none, the same 66-character line:
  POST /v2/speak flux-wes-en       8000, 16000, 24000, 32000, 44100, 48000 are a 200 with
                                   audio/l16;rate=<rate>. 12000, 22050, 96000 are a 400
                                   UNSUPPORTED_AUDIO_FORMAT "`sample_rate` must be 8000, 16000,
                                   24000, 32000, 44100, or 48000 when `encoding=linear16`".
  POST /v1/speak aura-2-thalia-en  same six rates a 200, same three a 400 with the same message.
  flux-cole-en, flux-meghan-en, flux-drew-en, aura-2-apollo-en: 8000, 16000, 24000, 48000 all 200.
  With no sample_rate, both endpoints answer audio/l16;rate=24000, so 24 kHz is the default.
Size: 2 bytes a sample, so 16, 32, 48 and 96 KB a second. On flux-wes-en: 8 kHz 65 KB (4.16 s),
16 kHz 133 KB (4.24 s), 48 kHz 405 KB (4.32 s). Audio length varies a little call to call, so
the run card shows the real size and the buttons show the fixed rate per second.
Detail: an FFT of each file had no energy above half the sample rate (4 kHz at 8000, 8 kHz at
16000, 12 kHz at 24000), and the 48 kHz file had real energy above 12 and 16 kHz on both
endpoints, so 48 kHz is not 24 kHz upsampled. The spectrum on the page stops at 12 kHz, so 24
and 48 look alike there; the copy says the difference is in the ear and the size.
Picking a button stops the line and speaks it again at that rate.
Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
spread (0.08 s) of 14 Flux voices tried.
```
