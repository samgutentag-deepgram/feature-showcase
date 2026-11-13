# Text-to-speech speed

**Slow down for the numbers.** Press Speak, then pick a speed any time: the line starts over at that pace. Slow it down for a confirmation number someone has to write down, speed it up for the disclaimer nobody wants to sit through. Same voice, same words.

- **Live:** https://dg-devrel-tts-speed.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-voice-controls

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-speed pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-speed`.

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
Speaking rate. Verified live 2026-11-12, linear16 at 24 kHz, container=none:
  POST /v2/speak flux-wes-en       speed 0.5-1.5 is a 200; 0.4 and 1.6 are a 400 "'speed' must be
                                   between 0.5 and 1.5". A 96-character line: 0.7 -> 8.72 s,
                                   1.0 -> 5.04 s, 1.5 -> 3.60 s.
  POST /v1/speak aura-2-thalia-en  speed 0.7-1.5 is a 200; 0.5, 0.65 and 1.55 are a 400 "'speed'
                                   must be within documented range". 0.7 -> 9.40 s, 1.0 -> 5.00 s.
So the buttons run 0.7 to 1.5, which every voice in the picker takes. Picking one stops the
line and speaks it again at that speed. (On the Flux socket, {"type":"Configure","speed":0.75}
between turns changes it without reconnecting: ConfigureSuccess, checked the same day.)
Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
spread (0.08 s) of 14 Flux voices tried.
```
