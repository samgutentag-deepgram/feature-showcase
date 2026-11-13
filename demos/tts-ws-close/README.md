# Graceful close for text-to-speech sockets

**Hang up without cutting off the last line.** Press Speak. The page sends the line, then closes the socket 600 ms later, while the audio is still coming, the way an app hangs up once it has sent its last words. Send Close and Deepgram finishes the line before it closes. Drop the socket and you hear only what arrived in time. Try both and compare the two runs.

- **Live:** https://dg-devrel-demos.fly.dev/demos/tts-ws-close/
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-ws-close

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-ws-close pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-ws-close`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: voices, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/tts/TtsShell.tsx`](../../shared/tts/TtsShell.tsx), with the
socket and the close in [`shared/tts/close.ts`](../../shared/tts/close.ts). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Close the text-to-speech socket without losing the end of the line. Verified live 2026-11-13
with a Node script on the key from .env, a 195-character line sent as Speak (no Flush), then the
socket closed 600 ms later, linear16 at 24 kHz, two runs each:
  wss /v2/speak flux-wes-en, {"type":"Close"}
      9.2-9.9 s of audio arrived after Close, the whole line; then SpeechMetadata and
      SessionMetadata (total_billable_character_count 195), then Deepgram closed it (1000).
  wss /v2/speak flux-wes-en, ws.close() from the client
      0.6-0.7 s of audio in all, nothing after the close (1000).
  wss /v1/speak aura-2-thalia-en, {"type":"Close"}
      7.6-7.7 s of audio after Close, no text message, then Deepgram closed it (1000).
  wss /v1/speak aura-2-thalia-en, ws.close() from the client
      1.7 s of audio in all, nothing after the close (Node saw 1006).
Close finishes the text already sent even with no Flush. Sending Close right after Speak, with or
without Flush, also played the whole line on both endpoints.
Voices: Flux first, Aura-2 after. flux-wes-en is the default, the steadiest Flux voice (2026-11-11).
```
