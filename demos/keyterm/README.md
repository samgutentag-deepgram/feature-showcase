# Keyterm prompting

**Was that Kallistrum or Callistram?** Product names, people, and jargon trip up any model the first time. Read the phrase without keyterms, then send the words you expect and read it again.

- **Live:** https://dg-devrel-keyterm.fly.dev
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/keyterm

## What to try

- **The suggested phrase.** The defaults are three invented products: Kallistrum, Vexmoor, and
  Trellisync. Press **Start mic**, read the phrase, then tick **Send keyterms** and read it again.
  In testing, Nova-3 wrote "Callistram", "Vexmor", and "Trella Sync" without keyterms, and got
  every one right with them.
- **Your own words.** Type a few names separated by commas. The phrase updates to use them.
- **The wire.** The Request card shows the exact query sent, one `keyterm=` per term. The
  Response card shows the last final transcript Deepgram returned, with your terms marked.

File upload is off in this demo; reading the phrase shows the effect. `FEATURE=keyterm pnpm sample` still writes
`samples/keyterm.mp3` for testing the API from the command line.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&keyterm=Kallistrum&keyterm=Vexmoor
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: transcript ═══════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `keyterm` is repeated once per term. A multi-word term is one param: `keyterm=Trellis+Sync`.
- With keyterms off, no `keyterm` param is sent at all.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=keyterm pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh keyterm`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`keyterm.test.ts`](keyterm.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`make-sample.sh`](make-sample.sh) | macOS only: builds a test clip into `samples/` (`FEATURE=keyterm pnpm sample`) |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
keyterm prompting on Nova-3: tell the model which rare words to expect, and it spells them.
Verified live 2026-11-09 on /v1/listen streaming with samples/keyterm.mp3: without keyterm,
"Callistram", "Vexmor", "Trella Sync", "Colistrum", "Trello Sync"; with
keyterm=Kallistrum&keyterm=Vexmoor&keyterm=Trellisync, all six spelled right.
Repeated params; a multi-word term (keyterm=Trellis+Sync) also works.
```
