# Dictation

**Say "comma." Get a comma.** Read the phrase, punctuation and all. Run it with dictation off, then on, and watch the spoken commands turn into punctuation and paragraphs.

- **Live:** https://dg-devrel-dictation.fly.dev
- **Kind:** Speech-to-text (Nova-3)
- **Docs:** https://developers.deepgram.com/docs/dictation

## What to try

- **The suggested phrase.** Press **Start mic** and read it, commands and all. Then tick **Turn on dictation** and read it again.
- **Your own.** Try "colon", "question mark", and "exclamation mark" too.
- **What we saw in testing.** Off, Nova-3 wrote the commands as words ("colon, period, New paragraph."). On, it wrote "Quick update: the demo is live." and a paragraph break.

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&punctuate=true&dictation=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ transcripts ════════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `dictation` goes with `punctuate=true`. "new paragraph" comes back as the token `<\n\n>`, drawn as a paragraph break.
- Flux answers `dictation` with a 400, so on Flux nothing is sent for it and the checkbox is off.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=dictation pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh dictation`.

## Files

| File | What |
|---|---|
| [`dictation.test.ts`](dictation.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
dictation on Nova-3: spoken punctuation becomes punctuation. Verified live 2026-11-09 on
/v1/listen streaming (macOS voice Samantha):
  punctuate=true                 "Dear team, comma, the demo is live. Period. New paragraph. ..."
  punctuate=true&dictation=true  "Quick update: the demo is live. <\n\n> ... for you? Let me know!"
"new paragraph" comes back as the literal token <\n\n>, drawn here as a paragraph break.
dictation is refused on Flux with a 400.
```
