# Keywords on Nova-2

**Still on Nova-2? Boost your words with keywords.** Before keyterm there was keywords: a list of
rare words, each with a weight (an intensifier), on Nova-2 and older models. Read the phrase
without keywords, then send them and read it again.

- **Live:** https://dg-devrel-demos.fly.dev/demos/keywords-legacy/
- **Kind:** Speech-to-text (Nova-2 only)
- **Docs:** https://developers.deepgram.com/docs/keywords

**On Nova-3 or Flux? Use keyterm.** Both answer `keywords` with a 400: Nova-3 says "Keywords are
not supported for Nova-3. Please use `keyterm` instead.", and Flux refuses it at the handshake.
The [keyterm demo](../keyterm/) shows the replacement, which takes plain terms and no weights.

## What to try

- **The suggested phrase.** The defaults are three invented products: Kallistrum, Vexmoor, and
  Trellisync. Press **Start mic**, read the phrase, then tick **Send keywords** and read it again.
  The two runs stay side by side.
- **The intensifier.** Pick `:1`, `:2`, or `:5` for every term, or type `Vexmoor:3` to give one
  term its own weight (up to 10 here). The docs advise starting low: high weights add false hits.
- **The wire.** The Request card shows the exact query sent, one `keywords=Term:weight` per term
  (the colon goes out encoded as `%3A`). The Response card shows the last final transcript, with
  your terms marked.

Suppression (a negative weight) works on Base models only, per the docs, so this page does not
offer it. File upload is off; reading the phrase shows the effect.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-2&smart_format=true&keywords=Kallistrum%3A2&keywords=Vexmoor%3A2
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: transcript ═══════════════════════════════
```

- The server mints a short-lived token for this page only. Your key never reaches the browser.
- `keywords` is repeated once per term. With keywords off, no `keywords` param is sent at all.
- Up to 100 keywords per request, per the docs; this page caps the list at 20.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=keywords-legacy pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, controls, copy. The comment at the top records what was verified live |
| [`keywords-legacy.test.ts`](keywords-legacy.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: ONLY=keywords-legacy pnpm verify:live passed (nova-2 socket opened for keywords off and :1, :2, :5, prompt URLs and docs link OK); pre-recorded nova-2 with keyterm.mp3 went from "Callistrum", "Vexmor" to "Kallistrum", "Vexmoor" with keywords=Kallistrum:2&keywords=Vexmoor:2&keywords=Trellisync:2; nova-3 + keywords is a 400 and the flux-general-en handshake with keywords is a 400 (101 without).
```
