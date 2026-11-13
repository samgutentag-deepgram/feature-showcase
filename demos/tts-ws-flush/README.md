# Stream LLM tokens to text-to-speech

**Start talking before the LLM finishes.** The reply below arrives a word at a time, the way an LLM streams it. Hear it three ways: wait for the whole reply first, send each token to Flux as it arrives, or stream the tokens but forget to Flush. Watch when the first audio plays, and how much was out before Flush.

- **Live:** https://dg-devrel-tts-ws-flush.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/flux-tts/client-messages

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-ws-flush pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-ws-flush`.

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
Speak an LLM's reply while it is still arriving, on the Flux socket (wss /v2/speak). The page
drips the reply out a word every 60 ms, like LLM tokens. Verified live 2026-11-12, flux-wes-en,
linear16 at 24 kHz, a 3-sentence reply (shared/tts/tokens.ts has the numbers):
  wait for the whole reply, then Speak + Flush: nothing plays until the text is complete
  Speak each token, Flush after the last: first audio 467 ms after the first token, 2.15 s of
  8.16 s out before Flush
  Speak each token, Flush 3 s late: the last 3.85 s of audio waited for Flush
Flux only (this lab is the Flux take on Speak + Flush). flux-wes-en is the default: the steadiest
of 14 English Flux voices on 2026-11-11.
```
