# Profanity filter

**Keep it clean.** Read the phrase, mild language and all. Run it with profanity_filter off, then on, and watch the swear words come back starred.

- **Live:** https://dg-devrel-profanity-filter.fly.dev
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/profanity-filter

## What to try

- **The suggested phrase.** Press **Start mic**, read it, then tick **Turn on profanity_filter** and read it again.
- **Flux.** Flip the model toggle. The filter works the same way there.
- **What we saw in testing.** "damn" and "shit" came back as `****` on both models. "hell" was not filtered on either.

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&profanity_filter=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ transcripts ════════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `profanity_filter` is sent either way, so the Request card always says which setting ran.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=profanity-filter pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh profanity-filter`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`profanity-filter.test.ts`](profanity-filter.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
profanity_filter on Nova-3 and Flux: swear words come back starred. Verified live 2026-11-09 on
/v1/listen and /v2/listen streaming with "This damn demo is so good. Holy shit, it caught every
word. What the hell." (macOS voice Samantha):
  off   "This damn demo is so good. Holy shit. It caught every word. What the hell?"
  on    "This **** demo is so good. Holy ****. It caught every word. What the hell?"
  Same result on both models. "hell" is not filtered on either.
```
