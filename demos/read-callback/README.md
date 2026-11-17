# Text Intelligence Callback

**Send the text. Get the summary later.** Type a support email, or keep the one in the box. Deepgram
answers the `/v1/read` POST at once with a `request_id`, then delivers the summary to a webhook on
this page's server, which checks the Basic Auth password it put in the callback URL.

- **Live:** https://dg-devrel-demos.fly.dev/demos/read-callback/
- **Kind:** LLM, Text Intelligence on `/v1/read` (typed text, `summarize=v2`)
- **Docs:** https://developers.deepgram.com/docs/text-intelligence-callback

## What to try

- **The suggested email.** Press send. The Response card shows the `request_id` the moment
  Deepgram takes the POST, then the delivered summary, whether the Basic Auth check passed, and the
  names of the headers the delivery carried.
- **PUT instead of POST.** Pick **Deliver with PUT** (`callback_method=put`) and run it again. The
  run says which method arrived.
- **Locally** the run stops before sending: Deepgram answers a localhost callback with a 400
  ("Invalid callback URL."). The round trip needs the deployed page, or `PUBLIC_URL` set to a tunnel.

## How it works

```
browser                       demos/read-callback/server.js       Deepgram
  │ POST api/callback  ───────▶ slot id + one-time password
  │ ◀── https://deepgram:<pw>@<host>/demos/read-callback/api/callback/<id>
  │ POST /v1/read?language=en&summarize=v2&callback=<that URL>  {"text": ...}  ─────▶
  │ ◀── 200 {"request_id": "..."}  (no summary yet)
  │                               ◀── POST (or PUT) the result JSON, Authorization: Basic ...
  │                                   checks the password: right 200, wrong 401
  │ GET api/callback/<id>  (polls once a second) ─▶ 202 waiting, then 200 {body, method, afterMs}
  │ GET api/receipt/<request_id> ─▶ check result, method, header names
```

- The browser sends the POST with a 30-second granted token. Your key never reaches the browser.
- Authentication follows the docs: credentials in the callback URL, which Deepgram sends back with
  the delivery.
- A delivery with wrong credentials gets a 401 and is dropped. A delivery with no `Authorization`
  header is kept and marked failed, because no real delivery has been seen yet (see below). Once one
  has, a missing header should get a 401 too.
- Slots take one delivery, live 10 minutes, and are rate limited. The receipt keeps header names,
  never values.
- `summarize` needs more than 50 words, or the summary is the text back. The suggested email is 116.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=read-callback pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: params, controls, copy, the Response and Result views. The comment at the top records what was verified live |
| [`server.js`](server.js) | The webhook: slots, the Basic Auth check, receipts |
| [`callback.test.ts`](callback.test.ts) | Unit tests for the webhook |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Docs notes (2026-11-16)

- An unresolvable callback host is refused up front with a 400 "Failed to resolve callback.", and a
  localhost one with a 400 "Invalid callback URL.". The docs mention neither.
- The docs curl omits `language`, but `/v1/read` without it is a 400.
- The docs curl sends `Content-Type: text/plain`; this page sends JSON `{"text": ...}`, which also works.

## Verified live

TODO
