# Flux TTS Configure

**Change the pace without hanging up.** Pick a speed and the line starts over at it. On the Flux socket, speed is a Configure message, not part of the URL: the page sends it before the first turn, and Flux confirms it with ConfigureSuccess. In a live conversation you send the same message between turns, with no reconnect.

- **Live:** https://dg-devrel-flux-tts-configure.fly.dev
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/flux-tts/client-messages

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=flux-tts-configure pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh flux-tts-configure`.

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
Change the speaking speed mid-session, without reconnecting. Verified live 2026-11-12 on wss
/v2/speak with flux-wes-en, linear16 at 24 kHz:
  {"type":"Configure","speed":0.5} between turns -> ConfigureSuccess {"applied":{"speed":0.5}},
  and the next turn obeys it: the same sentence took 5.04 s at 1.0, 12.8 s at 0.5, 4.0 s at 1.5.
  speed 2.0 -> ConfigureFailure SPEED_OUT_OF_RANGE ("between 0.5 and 1.5"); 1.17 ->
  SPEED_INCREMENT_INVALID ("increments of 0.05").
  Configure sent while a turn's text was already all in got no answer and changed nothing, so
  the page sends the line a phrase per turn. A pick restarts the line at the new speed (Sam's call
  for this demo), with Configure sent before the first turn.
Flux only: Aura-2's socket on /v1/speak has no Configure. flux-wes-en is the default: the
steadiest of 14 English Flux voices on 2026-11-11.
```
