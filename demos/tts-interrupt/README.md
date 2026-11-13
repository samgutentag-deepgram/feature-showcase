# Text-to-speech interrupt

**Let the caller cut in.** Press Speak, then talk over the agent while it is still talking, the way a caller would. Flux speech-to-text hears you start, the page cuts in, and the agent answers "Sure, go ahead." Try it with Interrupt, then with the audio stopped in the browser only, and compare how long the answer takes. Flux also says which words you heard.

- **Live:** https://dg-devrel-tts-interrupt.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/flux-tts/interrupt-handling

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-interrupt pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-interrupt`.

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
Barge-in on the text-to-speech socket. Verified live 2026-11-12, linear16 at 24 kHz, the first
phrase (211 characters) cut 1.5 s in, then the reply sent on the same socket:
  wss /v2/speak flux-wes-en, Interrupt with playback_offset 1014 ms
      SpeechInterrupted in 95 ms: audio_played_ms 1014, text_spoken "Thanks for calling ",
      text_remaining "Acme support. Your order shipped...". Reply audio 235 ms after the cut.
  wss /v2/speak flux-wes-en, no Interrupt
      the rest of the line (9.4 s of audio) streams first; reply audio 7256 ms after the cut.
  wss /v1/speak aura-2-thalia-en, Clear      Cleared in 21 ms; reply audio 90 ms after the cut.
  wss /v1/speak aura-2-thalia-en, no Clear   9.8 s of old audio first; reply 4675 ms after.
Billing is the whole line either way: billable_character_count stayed 211 after an Interrupt.
Voices: Flux first, Aura-2 after. text_spoken is Flux only; Aura-2's Clear just stops.
The cut-in is your voice: the mic streams to Flux speech-to-text and its StartOfTurn (about
500 ms into the speech, checked 2026-11-12) cuts in, the barge-in signal the Flux TTS docs use.
```
