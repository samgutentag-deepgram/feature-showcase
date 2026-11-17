# Redact usage

**Keep keyterms out of your usage logs.** Deepgram records the parameters of every request. Read the line with redact_usage off, then on: the transcript is the same, but the usage record for the second request stores `[REDACTED]` where your keyterms were.

- **Live:** https://dg-devrel-demos.fly.dev/demos/redact-usage/
- **Kind:** Speech-to-text (Flux and Nova-3)
- **Docs:** https://developers.deepgram.com/docs/redact-usage

## What to try

- **Off, then on.** Press **Start mic** and read the suggested phrase. Tick **Redact keyterms in
  the usage record** and read it again. The two runs sit side by side with the same transcript.
- **The wire.** The Request card shows `keyterm=Jane+Doe&keyterm=Acme&redact_usage=true`. The
  Response card shows the `request_id` and what the usage record for it stores.
- **Both models.** Flux and Nova-3 both take `redact_usage`.

This is a reference page: `redact_usage` changes nothing a visitor can see in the stream. It
changes what Deepgram keeps in the usage record, which you read back with the Management API for
the project that ran the request:

```bash
curl -H "Authorization: Token $DEEPGRAM_API_KEY" \
  "https://api.deepgram.com/v1/projects/$PROJECT_ID/requests/$REQUEST_ID"
```

With `redact_usage=true`, the `path` field came back as
`/v2/listen?model=flux-general-en&...&keyterm=%5BREDACTED%5D&keyterm=%5BREDACTED%5D&redact_usage=%5BREDACTED%5D`.
With it off, the keyterms were stored as sent. The page never calls that endpoint, and the
keyterms are fixed, not a text field, so visitors are not invited to type real names.

On Flux you can also send `"redact_usage": true` in a Configure message mid-stream. That redacts
keyterms sent in later Configure messages, not the URL, which is recorded when the socket opens.
This page sets it on the URL.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&keyterm=Jane+Doe&keyterm=Acme&redact_usage=true
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ TurnInfo: transcript, request_id ═════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=redact-usage pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`redact-usage.test.ts`](redact-usage.test.ts) | Unit tests for this demo, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
