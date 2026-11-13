# Text-to-speech expressivity

**Calm for support, bright for good news.** Press Speak, then pick a register any time, from calmest to liveliest: the line starts over with it. Same Flux voice, same words. Expressivity is in beta. Normal (0) is the tuned default, and the far ends can drop or repeat a word, so listen before you ship one.

- **Live:** https://dg-devrel-tts-expressivity.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-expressivity

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-expressivity pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-expressivity`.

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
Delivery register, calm to animated, from five buttons. Verified live 2026-11-12 on
POST /v2/speak, linear16 at 24 kHz, container=none: expressivity -2, -1, 0, 1 and 2 all 200 on
flux-wes-en, flux-cole-en, flux-meghan-en and flux-drew-en; 3 -> 400 EXPRESSIVITY_OUT_OF_RANGE,
1.5 -> 400 EXPRESSIVITY_INCREMENT_INVALID. On wss /v2/speak, expressivity=-2 in the query works too.
Duration and loudness barely move with it; the difference is pitch range, so judge it by ear.
Beta, Flux only (docs/tts-expressivity): 0 is the tuned default and the only value Deepgram
validates for production; larger values can drop or repeat words. The page says so.
expressivity is set per request (or per socket connection): picking a button stops the line and
speaks it again with that value.
flux-wes-en is the default: the steadiest of 14 Flux voices on 2026-11-11.
```
