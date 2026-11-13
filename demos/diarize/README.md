# Speaker diarization

**Who said that?** Grab someone nearby and read the script together. Turn on diarization and every word comes back tagged with its speaker, live.

- **Live:** https://dg-devrel-diarize.fly.dev
- **Kind:** Speech-to-text (Nova-3)
- **Docs:** https://developers.deepgram.com/docs/diarization

## What to try

- **The script.** Five short turns between Person 1 and Person 2. Press **Start mic**, read it
  together, then tick **Turn on diarization** and read it again. One voice reading both parts stays
  one speaker; that is diarization working, not failing.
- **Short turns.** Streaming diarization decides as the words arrive, so it can lag a speaker
  change by a word or two. In testing, "Hi Dana." stayed with the first speaker.
- **The wire.** The Request card shows the exact query. The Response card shows the first words
  of the last final result with the `speaker` Deepgram gave each one.

File upload is off in this demo for now. `FEATURE=diarize pnpm sample` still writes `samples/diarize.mp3`, the
same script in two built-in Mac voices, for testing the API from the command line.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&diarize_model=latest
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: words[].speaker ═══════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Each word in a `Results` message carries `speaker`, an index starting at 0. The page shows it
  as Speaker 1, Speaker 2, and so on.
- `diarize_model` has no "off" value, so the off run leaves it out. Streaming takes `latest` or
  `v1` (both the v1 diarizer today); `v2` is pre-recorded only and fails the streaming handshake.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=diarize pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh diarize`.

## Files

| File | What |
|---|---|
| [`diarize.test.ts`](diarize.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`make-sample.sh`](make-sample.sh) | macOS only: builds a test clip into `samples/` (`FEATURE=diarize pnpm sample`) |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Diarization on Nova-3 streaming: every word comes back with a speaker index, and the page
starts a new row each time it changes. Uses diarize_model, which replaced the deprecated boolean
diarize. Verified live 2026-11-12 on /v1/listen streaming with samples/diarize.mp3 (two macOS
voices, five turns): diarize_model=latest (v1 for streaming) labeled all five turns correctly.
With no diarize_model, no speaker comes back. diarize_model=v2 is pre-recorded only and fails the
streaming handshake, and Flux /v2/listen rejects diarize_model, so neither is offered here.
```
