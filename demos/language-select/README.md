# Language

**What happens when you pick the wrong language?** Nova-3 transcribes the one language you set
with `language`, and only that one. Read the line in a language you speak with it set to match,
then set `language` to a different one and read the same line again.

- **Live:** https://dg-devrel-demos.fly.dev/demos/language-select/
- **Kind:** Speech-to-text (Nova-3)
- **Docs:** https://developers.deepgram.com/docs/language

## What to try

- **The right language.** Pick a language you speak under **I'll read in** (eleven on offer: English,
  Catalan, Dutch, French, German, Hindi, Italian, Japanese, Portuguese, Russian, Spanish). The suggested line
  switches to it. Leave **Send language=** on the same one, press **Start mic**, and read it.
- **A wrong one.** Set **Send language=** to any other language and read the same line again. The
  two runs sit side by side. In testing, Spanish, French, German, and Japanese speech with
  `language=en` came back empty; English with `language=es` came back as English-ish words
  ("by the Windows"); Italian with `language=es` came back as sound-alike Spanish.
- **The wire.** The Request card shows the exact query. The Response card shows the last final
  transcript verbatim, `""` when nothing came back.

Flux is not offered: `/v2/listen` answers `language` with a 400. For Flux, or for speech that
mixes languages, see the [Language hint](../language-hint/) demo (`language_hint`, `language=multi`).

File upload is off in this demo; reading the line shows the effect.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&smart_format=true&language=es
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: "Quiero una mesa para 2 junto a la ventana, por favor." ═══
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- **I'll read in** only picks the suggested line. It is never sent.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=language-select pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, controls, copy. The comment at the top records what was verified live |
| [`languages.ts`](languages.ts) | The eleven languages on offer and the line to read in each |
| [`styles.css`](styles.css) | The two pickers and the tag on each run |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`language-select.test.ts`](language-select.test.ts) | Unit tests for this demo, run by `pnpm test` |

## Verified live

```text
Catalan added 2026-11-18: language=ca&smart_format=true with a macOS Montse clip came back word for
word 2 of 2.
Verified live 2026-11-16: pnpm verify:live opened all ten language= requests on /v1/listen (nova-3, smart_format=true) and the prompt.md URL with a granted token, and the docs link resolved; all passed.
```
