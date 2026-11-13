# Interim results

**Watch it think out loud.** Read the phrase at a normal pace. With interim_results on, words show up in gray while you talk and settle a moment later. With it off, nothing appears until a phrase is done.

- **Live:** https://dg-devrel-interim-results.fly.dev
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/interim-results

## What to try

- **The suggested phrase.** Press **Start mic** and read it with the setting on, then untick it and read it again.
- **Flux.** Flip the model toggle. Flux streams updates on its own, so there is no switch.
- **The wire.** The Response card shows the last message with words in it, and whether Deepgram called it final.

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&interim_results=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ transcripts ════════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Flux answers `interim_results` with a 400; it always sends `TurnInfo` `Update` events while you talk.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=interim-results pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh interim-results`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`interim-results.test.ts`](interim-results.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
interim_results on Nova-3: words show up while you are still talking, then settle. Verified live
2026-11-09 on /v1/listen streaming in real time (macOS voice Samantha, 13 s): interim_results=true
sent 5 interim messages before the finals; interim_results=false sent finals only. Flux always
streams TurnInfo Update events and refuses interim_results with a 400.
```
