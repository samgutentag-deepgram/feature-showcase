# Language hints

**Which language was that?** Talk in more than one language, or upload a clip. Deepgram tags the language of what it hears, and a new row starts every time the speaker switches.

- **Live:** https://dg-devrel-language-hint.fly.dev
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/nova-3-language-prompting

## What to try

- **Language hint.** Pick two languages (English and Spanish by default; try Spanish and Catalan
  too), then talk. Same stream, with `language_hint` added.
- **Auto detect.** Press **Start mic** and switch languages between words. No hints are sent;
  the model decides.
- **Upload.** Drop or choose an audio file (up to 1 minute and 1 MB). It stays loaded, so you
  can run it without hints, tick **Add language hints**, pick two languages, and run it again. The
  last two runs sit side by side for comparison. It plays aloud and streams at the same pace.
- **Flux.** Flip the model toggle. Flux multilingual covers ten languages and tags one language
  per turn, so rows split at pauses rather than mid-sentence. Catalan is not one of the ten.
- **The wire.** The panel shows the exact query sent and the `languages_hinted` Deepgram echoes back.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&language=multi&language_hint=es&language_hint=ca
  │  ═══ 16 kHz PCM from mic or file ═══════════════════════▶
  │  ◀═══ Results: words[].language, languages_hinted ═══════
```

- The server mints a short-lived token and does nothing else. Your key never reaches the browser,
  and audio never touches the server.
- Nova-3 returns a `language` on every word. The page starts a new row whenever it changes.
- Flux (`/v2/listen?model=flux-general-multi`) returns `languages` once per turn instead.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=language-hint pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh language-hint`.

## Files

| File | What |
|---|---|
| [`LanguagePicker.tsx`](LanguagePicker.tsx) | Helper used by `index.tsx` |
| [`Transcript.tsx`](Transcript.tsx) | Helper used by `index.tsx` |
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`language-hint.test.ts`](language-hint.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`languages.ts`](languages.ts) | Helper used by `index.tsx` |
| [`make-sample.sh`](make-sample.sh) | macOS only: builds a test clip into `samples/` (`FEATURE=language-hint pnpm sample`) |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`segments.ts`](segments.ts) | Helper used by `index.tsx` |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
language_hint on Nova-3 multilingual (changelog 2026-10-23), with Flux multi for contrast.
Rows split wherever the detected language changes; the hints steer detection.
```
