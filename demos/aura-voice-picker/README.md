# Aura-2 voices

**Hear every Aura-2 voice.** 90 Aura-2 voices in 7 languages, all on the same endpoint. Pick a language, then press any voice to hear the same line in it. The model name is the only thing that changes in the request.

- **Live:** https://dg-devrel-demos.fly.dev/demos/aura-voice-picker/
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-models

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=aura-voice-picker pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh aura-voice-picker`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: voices, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`voices.ts`](voices.ts) | The Aura-2 voice catalog from the docs, with one line per language |

The page around it is shared: [`shared/tts/TtsShell.tsx`](../../shared/tts/TtsShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.
Flux voices have their own tour in [`flux-tts-voices`](../flux-tts-voices/).

## Verified live

From the top of `index.tsx`:

```text
Browse the Aura-2 voices: pick a language, then a voice, and hear the same line in it. Every voice
is aura-2-{voice}-{language} on POST /v1/speak. Verified live 2026-11-13 with linear16, 24 kHz,
container=none: all 90 voices in the docs' catalog (voices.ts) came back 200 audio/l16;rate=24000,
each speaking its own language's line (2.2 s to 7.2 s of audio). GET /v1/models lists the same
90 plus aura-2-valentina-es, which the docs do not list yet, so it is left out.
pnpm verify:live requests every voice again.
Aura-2 only on purpose: this is the Aura-2 voice tour. Flux voices (flux-*, POST /v2/speak) have
their own, flux-tts-voices. aura-2-thalia-en is the default: the first featured English voice
in the docs.
```
