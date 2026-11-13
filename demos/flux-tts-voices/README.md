# Flux voices

**Hear every Flux voice.** 266 Flux voices in 47 languages, all on the same endpoint. Pick a language, then press any voice to hear the same line in it. The model name is the only thing that changes in the request.

- **Live:** https://dg-devrel-flux-tts-voices.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/flux-tts/voices

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-tts-voices pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh flux-tts-voices`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`voices.ts`](voices.ts) | Helper used by `index.tsx` |

The page around it is shared: [`shared/tts/TtsShell.tsx`](../../shared/tts/TtsShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Browse the Flux voices: pick a language, then a voice, and hear the same line in it. Every voice
is flux-{voice}-{language} on /v2/speak; all 266 in the docs' catalog answered 200 with audio on
2026-11-12 (voices.ts), and pnpm verify:live asks for each again.
flux-wes-en is the default: the steadiest of 14 English Flux voices on 2026-11-11 (0.2 dB
loudness and 0.08 s duration spread, same line 3 times). Every voice is cleared for use; marcus
and brittany are listed like the rest, just not the default, since they drift between calls.
```
