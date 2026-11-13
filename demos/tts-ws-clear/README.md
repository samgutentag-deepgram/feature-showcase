# Clear the text-to-speech socket

**Clear what the voice was about to say.** Press Speak, then press Cut in (or the space bar) while the voice is still talking. The page stops the audio it already has, sends `Clear` on the Aura-2 socket, and speaks "Sure, go ahead." on the same connection. The run card shows where the old line was at the cut: heard, already in the browser but never played, and still arriving. Try it with Clear, then without, and compare when the answer starts.

- **Live:** https://dg-devrel-demos.fly.dev/demos/tts-ws-clear/
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-ws-clear

Aura-2 only. Flux has no `Clear` (on `/v2/speak` it is an error and the socket closes); Flux cuts in with `Interrupt`, shown in [`tts-interrupt`](../tts-interrupt/).

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-ws-clear pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-ws-clear`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: voices, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/tts/TtsShell.tsx`](../../shared/tts/TtsShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

See the comment at the top of `index.tsx`. In short, on 2026-11-13 with four Aura-2 voices,
cutting 1.5 s into a 211-character line: `{"type":"Cleared","sequence_id":0}` came back in 20 to
198 ms, 0.04 to 0.56 s of old audio arrived between Clear and Cleared, and the answer's first audio
came 96 to 198 ms after the cut. Without Clear the answer waited behind 8.6 s more of the old line.
`sequence_id` counts the Clear messages sent on the socket.
