# Multilingual code-switching

**Two languages, one sentence?** Read a sentence that starts in English and finishes in Spanish.
Deepgram transcribes it as one stream, and Nova-3 tags every word with the language it heard.

- **Live:** https://dg-devrel-demos.fly.dev/demos/multilingual-code-switching/
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/multilingual-code-switching

## What to try

- **Nova-3.** Pick **English + Spanish** (or **English + French**), press **Start mic**, and read
  the suggested sentence. Each word is underlined in its language's color, and the language code
  shows where the switch happened. The Response card shows the two words on either side of the
  first switch in the latest final result, straight from `words[].language`.
- **Flux.** Flip the model toggle and read the same sentence. Flux multilingual
  (`model=flux-general-multi`) code-switches without a `language` param and lists the languages
  once per turn (`languages` on each `TurnInfo`), so the words are not tagged one by one. The last
  two runs sit side by side to compare.

How this differs from its neighbors: `language-hint` steers detection toward languages you name;
a single fixed `language=es` transcribes one language only. Here nothing is hinted and nothing is
fixed.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&language=multi&endpointing=100
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: words[].language on every word ═══════════
```

- `endpointing=100` is what the docs recommend for code-switching on a stream.
- Flux: `wss /v2/listen?model=flux-general-multi`. Sending `language=multi` there is a 400
  (`Unknown query parameters: language`).

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=multilingual-code-switching pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`pairs.ts`](pairs.ts) | The language pairs, their suggested sentences, and the color slot for each language |
| [`WordsByLanguage.tsx`](WordsByLanguage.tsx) | The transcript: words underlined by language, codes at each switch |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
