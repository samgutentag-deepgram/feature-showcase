# Filler words

**Um, did it hear that?** Read the phrase with all its ums and uhs. Run it with filler_words off, then on, and see which hesitations Deepgram keeps.

- **Live:** https://dg-devrel-filler-words.fly.dev
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/filler-words

## What to try

- **The suggested phrase.** Press **Start mic** and read it with `filler_words` off, then tick **Turn on filler_words** and read it again.
- **Flux.** Flip the model toggle. Flux keeps fillers on its own, so there is no switch.
- **What we saw in testing.** Off, Nova-3 dropped all five. On, it kept both "uh" and dropped all three "um". Flux kept all five.

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&filler_words=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ transcripts ════════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Nova-3 drops fillers unless `filler_words=true`. Flux keeps them and answers `filler_words` with a 400, so nothing is sent for it on Flux.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=filler-words pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh filler-words`.

## Files

| File | What |
|---|---|
| [`filler-words.test.ts`](filler-words.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
filler_words on Nova-3: keep or drop "um" and "uh". Verified live 2026-11-09 on /v1/listen
streaming with "So, um, I think we should, uh, ship the demo on, um, Thursday. Uh, does that
work for you?" (macOS voice Samantha):
  filler_words=false  "So I think we should ship the demo on Thursday. Does that work for you?"
  filler_words=true   "So I think we should uh, ship the demo on Thursday. Uh, does that work for you?"
                      (both uh kept, all three um dropped)
  Flux                keeps all five on its own; filler_words is refused with a 400.
```
