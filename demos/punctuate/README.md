# Punctuate

**Did it hear the question mark?** Read a question and two short sentences. Run it with punctuate off, then on, and watch the capitals, periods, and question mark appear.

- **Live:** https://dg-devrel-demos.fly.dev/demos/punctuate/
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/punctuation

## What to try

- **The suggested phrase.** Press **Start mic** and read it with `punctuate` off, then tick **Turn on punctuate** and read it again. The two runs sit side by side.
- **Flux.** Flip the model toggle. Flux punctuates on its own, so there is no switch.
- **What we saw in testing.** Off, Nova-3 wrote "did you get my message", all lowercase with no marks. On, it wrote "Did you get my message?" and capitalized "Tuesday". Flux wrote the punctuated version with nothing set.

Every phrase on the page is a suggestion. Your own words work too.

## How it relates to smart_format

`smart_format=true` turns punctuation on by itself (the [smart format docs](https://developers.deepgram.com/docs/smart-format) say there is no need to also set `punctuate=true`). This demo never sends `smart_format`, so the only switch is `punctuate`. The [smart-format demo](../smart-format/) shows the number, date, and currency formatting on top.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&punctuate=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: "Did you get my message?" ════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Nova-3 leaves transcripts lowercase and unpunctuated unless `punctuate=true`. Flux punctuates and
  answers `punctuate` with a 400, so nothing is sent for it on Flux.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=punctuate pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`punctuate.test.ts`](punctuate.test.ts) | Unit tests for this demo, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: verify:live opened /v2/listen?model=flux-general-en and /v1/listen?model=nova-3&punctuate=false|true, all accepted; streamed the phrase: Nova-3 off gave lowercase with no marks, on gave "Did you get my message?" and "Tuesday.", Flux punctuated with nothing set.
```
