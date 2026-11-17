# Diarizer v1 vs v2

**Same call, two diarizers.** Send one short support call through the v1 diarizer, then v2, and
compare who Deepgram says spoke each line. Runs stay side by side.

- **Live:** https://dg-devrel-demos.fly.dev/demos/diarize-model-v2/
- **Kind:** Speech-to-text (Nova-3, pre-recorded)
- **Docs:** https://developers.deepgram.com/docs/diarization

## What to try

- **Sample call.** With **v1** picked, press **Send with diarize_model=v1**. Then pick **v2** and
  send it again. Each run shows how many speakers and turns came back, one row per turn.
- **latest.** On pre-recorded audio it resolves to v2 today. The Response card shows
  `metadata.diarize_info.arch`, so you can see which diarizer actually ran.
- **Record.** Two people at one mic read the six-line script, up to 30 seconds, sent as one POST.
  One voice reading both parts stays one speaker; that is diarization working, not failing.

The sample, `support-call.mp3`, is synthetic: six turns in two Deepgram Flux text-to-speech voices
(`flux-wes-en` and `flux-drew-en`), made by [`make-sample.sh`](make-sample.sh). It is bundled
because diarization needs two voices, and one visitor at a mic has one.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  POST /v1/listen?model=nova-3&smart_format=true&diarize_model=v2
  │  Authorization: Bearer <token>, body: the clip ──────────▶
  │  ◀─── JSON: words[].speaker, speaker_confidence, metadata.diarize_info
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `diarize_model=v2` is pre-recorded only: the streaming handshake answers it with a 400, and so
  does Flux on `/v2/listen`. That is why every run here is one POST, on Nova-3.
- Do not also send `diarize=true`. With `diarize_model` it is a 400.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=diarize-model-v2 pnpm dev
```

Then open <http://localhost:8080>. `FEATURE=diarize-model-v2 pnpm sample` rebuilds the sample
clip (needs ffmpeg and the key in `.env`).

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`make-sample.sh`](make-sample.sh) | Rebuilds `support-call.mp3` from Deepgram text-to-speech |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`support-call.mp3`](support-call.mp3) | The synthetic two-voice sample, about 18 s, 100 KB |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

Verified live 2026-11-16: pnpm verify:live passed (v1, v2, latest on the Sample and Record modes), and POST /v1/listen?model=nova-3&smart_format=true with a granted Bearer token on support-call.mp3 gave v1 speakers [0] (one speaker for all six turns), v2 and latest [0, 1, 0, 1, 0, 1] with diarize_info.arch v2.
