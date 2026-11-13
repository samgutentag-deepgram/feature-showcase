# Smart format

**Four eight one five, or 4815?** Read out a phone number, a date, and a price. Run it with smart_format off, then on, and compare what Deepgram writes down.

- **Live:** https://dg-devrel-smart-format.fly.dev
- **Kind:** Speech-to-text (Nova-3)
- **Docs:** https://developers.deepgram.com/docs/smart-format

## What to try

- **The suggested phrase.** Press **Start mic** and read it. Then tick **Turn on smart_format**
  and read it again. The two runs sit side by side.
- **Your own.** Read your favorite order number, a date, and a price.
- **The wire.** The Request card shows the exact query, with `smart_format` sent either way so it
  always says which setting ran. The Response card shows the last final transcript verbatim.

File upload is off in this demo; reading the phrase shows the effect. `FEATURE=smart-format pnpm sample` still writes
`samples/smart-format.mp3` for testing the API from the command line.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&smart_format=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: "Call us back at (555) 212-8899" ═════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=smart-format pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh smart-format`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`make-sample.sh`](make-sample.sh) | macOS only: builds a test clip into `samples/` (`FEATURE=smart-format pnpm sample`) |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`smart-format.test.ts`](smart-format.test.ts) | Unit tests for this demo, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
smart_format on Nova-3: the same audio, written down raw or the way people write.
Verified live 2026-11-09 on /v1/listen streaming: false gives "four eight one five one six",
true gives "4815162342", "$129.99", "(555) 212-8899".
```
