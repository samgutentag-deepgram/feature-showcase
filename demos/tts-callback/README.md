# Text-to-speech callback

**Get the audio later, on your webhook.** Press Speak. Deepgram answers at once with a `request_id` and no audio, makes the speech, then sends the file to the demo's own server as a webhook, and the page plays it. Pick PUT to have it delivered by PUT, or Low priority to queue it as a batch job on Flux, where Deepgram fetches the text from a URL instead of the request body.

- **Live:** https://dg-devrel-demos.fly.dev/demos/tts-callback/
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-callback

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-callback pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh tts-callback`.

Locally the webhook is on `localhost`, which Deepgram cannot reach, so the page says so and sends
nothing. Set `PUBLIC_URL` to a public address that reaches the server to try the whole trip.

## How the webhook works

This demo has server routes of its own, in [`server.js`](server.js). The site's `server.js` mounts
them at `/demos/tts-callback/api/`, for this demo only:

| Route | Who calls it | What it does |
|---|---|---|
| `POST /demos/tts-callback/api/callback` | the page, same-origin, 10 a minute | Makes a slot for one line: returns its `callback` URL and, for `priority=low`, its text URL |
| `POST` or `PUT /demos/tts-callback/api/callback/:id` | Deepgram | Takes the audio body once. Unknown ids 404, non-audio 415, over 2 MB 413 |
| `GET /demos/tts-callback/api/callback/:id/text` | Deepgram, `priority=low` | The slot's text, as `text/plain` |
| `GET /demos/tts-callback/api/callback/:id` | the page, same-origin | 202 while waiting, then the audio once, and the slot is dropped |

Slots live 10 minutes, and at most 20 wait at a time.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: params, controls, copy. The comment at the top records what was verified live |
| [`server.js`](server.js) | The webhook receiver: slots, delivery, the text URL for `priority=low`, and polling |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/tts/TtsShell.tsx`](../../shared/tts/TtsShell.tsx), with
the callback steps in [`shared/tts/callback.ts`](../../shared/tts/callback.ts).

## Verified live

See the comment at the top of `index.tsx`: 2026-11-13, both endpoints, with the key and a granted
token, and a full round trip through a public receiver. The page itself was checked against a
local server with Deepgram's real deliveries replayed into its slots; the deployed webhook is not
checked until the first deploy.
