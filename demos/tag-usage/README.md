# Tag requests

**Which team ran this request?** A tag rides along with the request and lands in your usage reports, not in the transcript. Pick a team, read the line, and see the tag on the request and the request_id it is filed under.

- **Live:** https://dg-devrel-demos.fly.dev/demos/tag-usage/
- **Kind:** Speech-to-text (Flux and Nova-3)
- **Docs:** https://developers.deepgram.com/docs/stt-tagging

## What to try

- **One tag.** Pick **team-support** or **team-sales**, press **Start mic**, and read the line. The
  Request card shows `tag=team-support`; the Response card shows the `request_id`.
- **Two tags.** Tick **Add a second tag** and the Request card shows the param repeated:
  `tag=team-support&tag=env-demo`.
- **Both models.** Flux and Nova-3 both take `tag`. The transcript is the same with or without it.

This is a reference page: a tag changes nothing a visitor can see in the stream. Neither socket
echoes it in its transcript messages (Nova-3 sends it only in the Metadata message at the close,
which the shared page does not show). It shows up in the Management API for the project that ran
the request:

```bash
curl -H "Authorization: Token $DEEPGRAM_API_KEY" \
  "https://api.deepgram.com/v1/projects/$PROJECT_ID/requests/$REQUEST_ID"   # response.details.tags
curl -H "Authorization: Token $DEEPGRAM_API_KEY" \
  "https://api.deepgram.com/v1/projects/$PROJECT_ID/usage?tag=team-support"  # only tagged requests
```

The page never calls those endpoints. The tags are fixed choices, not a text field, so visitors
cannot fill the project's 500 unique tags a day.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v2/listen?model=flux-general-en&tag=team-support
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ TurnInfo: transcript, request_id ═════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tag-usage pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`tag-usage.test.ts`](tag-usage.test.ts) | Unit tests for this demo, run by `pnpm test` |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
TODO
```
