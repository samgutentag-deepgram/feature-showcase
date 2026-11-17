# Extra metadata

**Send an order ID. Get it back.** Tag the request with your own key:value pairs, read the phrase, and Deepgram hands them back inside every transcript message, so the result already knows which order, call, or customer it belongs to.

- **Live:** https://dg-devrel-demos.fly.dev/demos/extra-metadata/
- **Kind:** Speech-to-text (Nova-3 only)
- **Docs:** https://developers.deepgram.com/docs/extra-metadata

## What to try

- **The defaults.** The page sends `order_id:A1042` and `team:support`. Press **Start mic**, read
  the phrase, and the Response card shows `metadata.extra` as Deepgram returned it.
- **Your own pairs.** Change a key or a value, or clear the second row to send one pair. A row
  missing its key or its value is not sent.
- **The wire.** The Request card shows the exact query, one `extra=` per pair. The colon is
  URL-encoded as `%3A` and a space as `+`; Deepgram decodes both.

File upload is off in this demo; what comes back does not depend on the audio.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&extra=order_id%3AA1042&extra=team%3Asupport
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: metadata.extra {"order_id":"A1042","team":"support"} ═══
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- On a stream, `metadata.extra` rides on every `Results` message, interim and final, and on the
  `Metadata` message sent at close.
- With no filled rows, no `extra` param is sent, and the response has no `extra` key.
- Flux does not take `extra` yet: `/v2/listen` answers the handshake with a 400,
  `Unknown query parameters: extra`. The docs page lists Flux as supported.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=extra-metadata pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
extra on Nova-3: tag a request with your own key:value pairs and get them back in the response.
Checked live 2026-11-16 on /v1/listen streaming with a macOS-voice clip:
extra=order_id%3AA1042&extra=team%3Asupport+desk came back as
metadata.extra = {"order_id":"A1042","team":"support desk"} on every Results message, interim
and final, and on the closing Metadata message. With no extra sent, metadata has no extra key.
Flux refuses it: /v2/listen answers the handshake with 400 "Unknown query parameters: extra".
Verified live 2026-11-16: ONLY=extra-metadata pnpm verify:live passed (both variants, two pairs and one pair, accepted on /v1/listen nova-3, plus the prompt URL); a streamed clip returned metadata.extra {"order_id":"A1042","team":"support desk"} on every Results message.
```
