# Text-to-speech pronunciation

**Say the drug name right.** Drug names, brands and surnames trip up any voice. Pick a word, then hear it as written and with an IPA override in the text: the override tells Flux exactly how to say it. Pronunciation on Flux is in Early Access, so play each one a few times.

- **Live:** https://dg-devrel-tts-pronunciation.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-voice-controls

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-pronunciation pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-pronunciation`.

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
Fix how a word is said with an inline IPA override, on Flux (Early Access). Verified live
2026-11-12 on POST /v2/speak, flux-wes-en and flux-hannah-en, linear16 at 24 kHz:
  'Take \{"word": "dupilumab", "pronounce": "duːˈpɪljuːmæb"\} twice daily.'  200,
  dg-pronunciations-applied: 1 (the same line without the override: 0).
  With speed=1.2 as well -> 400 CONTROL_COMBINATION_INVALID ("pronunciation and speed controls
  cannot be combined"), so this page sends no speed.
IPA from the docs' own examples (docs/tts-voice-controls), in the broad American style Flux was
trained on. Early Access: the docs say an override can come out differently from one generation
to the next, so the page says to listen a few times. pnpm verify:live requests every term, both
ways, on every voice. Flux only here (Aura-2 takes the same syntax with the stress mark placed
before the vowel). flux-wes-en is the default: the steadiest of 14 English Flux voices.
```
