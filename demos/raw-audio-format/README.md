# Raw audio format

**Raw audio has no header. Say what it is.** Pick linear16 at 16 kHz, linear16 at 8 kHz, mulaw at
8 kHz (phone audio), or alaw at 8 kHz, and read the phrase. The page streams your mic in that format
and names it with `encoding` and `sample_rate`. Then pick Mismatch: the page streams linear16 at
16 kHz but declares mulaw at 8 kHz, and the transcript comes back empty, with no error.

- **Live:** https://dg-devrel-demos.fly.dev/demos/raw-audio-format/
- **Kind:** Speech-to-text (Flux and Nova-3)
- **Docs:** https://developers.deepgram.com/docs/encoding

## What to try

- **A phone format.** Leave **mulaw 8 kHz** picked, press **Start mic**, and read the phrase.
- **The mismatch.** Pick **Mismatch** and read it again. The two runs sit side by side: the same
  voice, one transcript, one empty.
- **The wire.** The Request card shows the exact query, with `encoding` and `sample_rate` marked.
  The note under the picker says what the page actually streams.

Mic only; reading the phrase shows the effect.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&encoding=mulaw&sample_rate=8000
  │  ═══ mic, 16 kHz PCM converted to 8 kHz mu-law in the page ═══▶
  │  ◀═══ TurnInfo: "Please call me back at the front desk." ═══════
```

- Capture always yields 16 kHz linear16. `shared/stt/audio.ts` converts each chunk to the picked
  format before it goes on the socket; `audio()` in `index.tsx` says which format that is.
- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=raw-audio-format pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, formats, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`raw-audio-format.test.ts`](raw-audio-format.test.ts) | Unit tests for this demo, run by `pnpm test` |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
