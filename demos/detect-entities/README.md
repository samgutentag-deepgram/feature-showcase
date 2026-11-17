# Detect entities

**Who, where, when, and how much?** Read out a name, a phone number, an email, a date, an address,
and an amount. Deepgram labels each one and says which words it covers, as you speak.

- **Live:** https://dg-devrel-demos.fly.dev/demos/detect-entities/
- **Kind:** Speech-to-text (Nova-3 only; Flux answers `detect_entities` with a 400)
- **Docs:** https://developers.deepgram.com/docs/detect-entities

## What to try

- **The suggested phrase.** Press **Start mic** and read it. Each entity is marked in the
  transcript with its label, and the Response card lists every one with `label`, `value`,
  `confidence`, `start_word`, and `end_word`.
- **smart_format off.** Untick **Also send smart_format=true** and read it again. The values come
  back as the words you said ("four one five ..."); with it on they come back formatted and
  `raw_value` keeps the spoken words. The two runs sit side by side.
- **The sibling.** This demo finds sensitive spans. To hide them instead, see
  [redact](../redact/).

File upload is off in this demo; reading the phrase shows the effect.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&detect_entities=true&smart_format=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results (is_final): { ..., "entities": [{ "label": "NAME", ... }] }
```

- On the socket, `entities` is a top-level field of each final `Results` message, next to
  `channel`. Interim results carry none. `start_word` and `end_word` count words inside that one
  result, and `end_word` is exclusive.
- The page collects the finals of a run by `metadata.request_id` and marks each span in the
  transcript.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=detect-entities pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, controls, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | Entity marks in the transcript and the Response card list |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`detect-entities.test.ts`](detect-entities.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: ONLY=detect-entities pnpm verify:live passed (both smart_format
variants open on Nova-3), and the suggested phrase as a say clip streamed in real time came back
with NAME, PHONE_NUMBER, EMAIL_ADDRESS, DATE, LOCATION_ADDRESS, LOCATION_CITY, and MONEY,
confidence 0.93 to 0.99.
```
