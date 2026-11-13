# Measurements

**Five kilograms, or 5 kg?** Read the phrase with measurements off, then on. Weights and lengths come back as numbers and units, the way a shipping label writes them.

- **Live:** https://dg-devrel-measurements.fly.dev
- **Kind:** Speech-to-text (Nova-3)
- **Docs:** https://developers.deepgram.com/docs/measurements

## What to try

- **The suggested phrase.** Press **Start mic** and read it with measurements off, then tick **Turn on measurements** and read it again.
- **What we saw in testing.** Kilograms and centimeters converted. "ten minutes" and "seventy degrees" did not.
- **Flux.** Flux answers `measurements` with a 400, so the toggle shows Flux without it.

Every phrase on the page is a suggestion. Your own words work too.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&measurements=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ transcripts ════════════════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `measurements` is sent either way on Nova-3, so the Request card always says which setting ran.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=measurements pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh measurements`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`measurements.test.ts`](measurements.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
measurements on Nova-3: spoken units come back abbreviated. Verified live 2026-11-10 in real
time on "The package weighs five kilograms, it is forty centimeters wide, and it should arrive
in ten minutes at seventy degrees." (macOS voice Samantha):
  measurements off   "the package weighs five kilograms ‖ it is forty centimeters wide ‖ ..."
  measurements=true  "the package weighs 5 kg it is 40 cm wide ‖ ... in ten minutes at seventy degrees"
Weights and lengths converted; "ten minutes" and "seventy degrees" did not. Flux refuses
measurements with a 400.
```
