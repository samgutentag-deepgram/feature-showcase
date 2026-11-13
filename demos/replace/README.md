# Find and replace

**Say Acme. Get ACME Corp.** Pick a word you will say and what it should come back as. Read the phrase with replace off, then on, and watch Deepgram swap it before the transcript reaches you.

- **Live:** https://dg-devrel-replace.fly.dev
- **Kind:** Speech-to-text (Nova-3)
- **Docs:** https://developers.deepgram.com/docs/find-and-replace

## What to try

- **The suggested phrase.** Press **Start mic** and read it. Then tick **Send replace** and read it again. "Acme" comes back as "ACME Corp" and "Monday" as "Mon".
- **Your own.** Change the pairs. Match the casing the transcript uses: with `smart_format` on, names and days are capitalized.
- **Flux.** Flux answers `replace` with a 400, so the toggle shows Flux without it.

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&smart_format=true&replace=Acme%3AACME+Corp
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ transcripts ════════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `replace` is repeated once per pair, `find:replacement`, URL-encoded on the wire. In testing, `replace=Acme:...` did nothing without `smart_format`, because the transcript said "acme".

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=replace pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh replace`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`replace.test.ts`](replace.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
replace on Nova-3: swap a word Deepgram hears for the text you want. Verified live 2026-11-10 on
/v1/listen streaming with "Thanks for calling Acme. Our new product, Kallistrum, ships on Monday."
(macOS voice Samantha):
  smart_format=true                                  "Thanks for calling Acme. ... ships on Monday."
  smart_format=true&replace=Acme%3AACME+Corp&replace=Monday%3AMon
                                                     "Thanks for calling ACME Corp. ... ships on Mon."
The find side matches the transcript's casing: without smart_format the transcript says "acme",
and replace=Acme:... does nothing. Flux refuses replace with a 400.
```
