# Multichannel

**Agent on the left, customer on the right.** Send one stereo support call with `multichannel`
off, then on. Off, Deepgram mixes both sides into one transcript. On, it transcribes each channel
on its own, and the page lines the two up by time. Runs stay side by side.

- **Live:** https://dg-devrel-demos.fly.dev/demos/multichannel/
- **Kind:** Speech-to-text (Nova-3, pre-recorded)
- **Docs:** https://developers.deepgram.com/docs/multichannel

## What to try

- **Off first.** With the box unticked, press **Send with multichannel=false**. One channel comes
  back, all six lines run together, and nothing says who spoke.
- **Then on.** Tick **Turn on multichannel** and send again. Two channels come back: the agent's
  three lines in the left column, the customer's three in the right. The Response card shows
  `metadata.channels` and each channel's `transcript`.

The sample, `call-stereo.mp3`, is synthetic: six lines in two Deepgram Flux text-to-speech voices,
`flux-wes-en` on the left channel (agent) and `flux-drew-en` on the right (customer), each silent
while the other talks. [`make-sample.sh`](make-sample.sh) rebuilds it. It is bundled because
multichannel needs audio with more than one channel, and a browser mic records one.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  POST /v1/listen?model=nova-3&smart_format=true&multichannel=true
  │  Authorization: Bearer <token>, body: the stereo clip ───▶
  │  ◀─── JSON: results.channels[0] (left), results.channels[1] (right), metadata.channels
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Each entry in `results.channels` has its own `alternatives[0].transcript` and word timings, so
  the page cuts each channel into lines at pauses over a second and sorts them by start time.
- Streaming takes it too: `/v1/listen` with `multichannel=true&channels=2` and interleaved stereo
  `linear16` tags each `Results` with `channel_index` (`[0, 2]` or `[1, 2]`). This page does not
  stream because a browser mic is mono. Flux (`/v2/listen`) answers `multichannel` with a 400
  ("Unknown query parameters"), although the docs page lists Flux streaming as supported.
- On pre-recorded audio, smart formatting, entity detection, and redaction use context from every
  channel, per the docs.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=multichannel pnpm dev
```

Then open <http://localhost:8080>. `FEATURE=multichannel pnpm sample` rebuilds the sample clip
(needs ffmpeg and the key in `.env`).

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`make-sample.sh`](make-sample.sh) | Rebuilds `call-stereo.mp3` from Deepgram text-to-speech |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`call-stereo.mp3`](call-stereo.mp3) | The synthetic stereo sample, about 17 s, 135 KB |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

TODO
