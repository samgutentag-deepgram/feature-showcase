# MIP opt-out

**Opt out. Same transcript.** Read the phrase with `mip_opt_out` off, then on. The transcript does
not change and no response field echoes the setting. The effect is on what Deepgram keeps after the
request, not on what it writes down, so this page is a one-param reference: the exact query, on both
models, accepted live.

- **Live:** https://dg-devrel-demos.fly.dev/demos/mip-opt-out/
- **Kind:** Speech-to-text (Flux and Nova-3)
- **Docs:** https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program

## What to try

- **The suggested phrase.** Press **Start mic** and read it. Then tick **Turn on mip_opt_out** and
  read it again. The two runs sit side by side; read it the same way and the words come back the same.
- **The wire.** The Request card shows `mip_opt_out` sent either way, so it always says which
  setting ran. The Response card shows the last final transcript; nothing in it mentions the opt-out.

What the docs say it does: data from opted-out requests is "retained only for the duration
necessary to process the request." Nothing a visitor can see on this page proves that; it is a
data-handling promise, not a transcript change.

File upload is off in this demo.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=mip-opt-out pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was checked live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: pnpm verify:live opened /v2/listen (flux-general-en) and /v1/listen (nova-3) with mip_opt_out=false and =true, all four accepted; prompt.md and the docs link resolved.
```
