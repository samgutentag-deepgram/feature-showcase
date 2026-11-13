# Numerals

**Twenty five, or 25?** Read the phrase with numerals off, then on. Spoken numbers come back as digits, and nothing else about the transcript changes.

- **Live:** https://dg-devrel-numerals.fly.dev
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/numerals

## What to try

- **The suggested phrase.** Press **Start mic** and read it with numerals off, then tick **Turn on numerals** and read it again.
- **Nova-3.** Flip the model toggle and do it again.
- **What we saw in testing.** "twenty five boxes, three hundred and twelve labels" became "25 boxes, 312 labels" on both models.

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&numerals=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ transcripts ════════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `smart_format` also converts numbers, plus punctuation and dates. `numerals` is only the digits.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=numerals pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh numerals`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`numerals.test.ts`](numerals.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
numerals on Flux and Nova-3: spoken numbers come back as digits, and nothing else changes.
Verified live 2026-11-10 in real time on "I need twenty five boxes, three hundred and twelve
labels, and two thousand twenty six stickers by the fifteenth." (macOS voice Samantha):
  Flux, numerals off   "... twenty five boxes, three hundred and twelve labels ... the fifteenth."
  Flux, numerals=true  "I need 25 boxes, 312 labels, and 2026 stickers by the 15th."
  Nova-3 numerals=true "i need 25 boxes ‖ 312 labels ‖ and 2026 stickers by the 15th"
smart_format would also do this, plus punctuation and capitals; numerals is only the digits.
```
