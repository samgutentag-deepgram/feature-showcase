# Callback

**Send the audio. Get the transcript later.** Record a line. Deepgram answers the POST at once with
a `request_id`, then delivers the transcript to a webhook on this page's server, which checks the
Basic Auth password it put in the callback URL.

- **Live:** https://dg-devrel-demos.fly.dev/demos/callback/
- **Kind:** Speech-to-text, pre-recorded (Nova-3 only; Flux answers `callback` with a 400)
- **Docs:** https://developers.deepgram.com/docs/callback

## What to try

- **The suggested phrase.** Press **Record**, read it, stop. The Response card shows the
  `request_id` the moment Deepgram takes the POST, then the delivered transcript, whether the Basic
  Auth check passed, and the names of the headers the delivery carried.
- **PUT instead of POST.** Pick **Deliver with PUT** (`callback_method=put`) and run it again. The
  timeline under the run says which method arrived.
- **Locally** the run stops before sending: Deepgram answers a localhost callback with a 400
  ("Invalid callback URL."). The round trip needs the deployed page.

## How it works

```
browser                       demos/callback/server.js            Deepgram
  │ POST api/callback  ───────▶ slot id + one-time password
  │ ◀── https://deepgram:<pw>@<host>/demos/callback/api/callback/<id>
  │ POST /v1/listen?model=nova-3&smart_format=true&callback=<that URL>  ─────▶
  │ ◀── 200 {"request_id": "..."}  (no transcript yet)
  │                               ◀── POST (or PUT) the transcript JSON, Authorization: Basic ...
  │                                   checks the password: right 200, wrong 401
  │ GET api/callback/<id>  (polls once a second) ─▶ 202 waiting, then 200 with the JSON
  │ GET api/receipt/<request_id> ─▶ check result, method, header names
```

- The browser sends the POST with a 30-second granted token. Your key never reaches the browser.
- Authentication follows the docs' recommendation: credentials in the callback URL, which Deepgram
  sends back with the delivery. The docs also describe a shared secret in `extra`
  (`extra=callback_secret:<value>`, returned in `metadata.extra`). The docs do not describe a
  signature header such as `dg-token`; the receipt shows whether one arrives.
- A delivery with wrong credentials gets a 401 and is dropped. A delivery with no `Authorization`
  header is kept and marked failed, because no real delivery has been seen yet (see below). Once one
  has, a missing header should get a 401 too.
- Slots take one delivery, live 10 minutes, and are rate limited. The receipt keeps header names,
  never values.

Not built here: streaming callbacks. The docs say a streaming `callback` sends each result to the
URL (POST for http(s), messages for ws(s)); the integrator found a streaming v1 socket with
`callback` returns nothing on the socket itself, so there is nothing for this page to show.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=callback pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, controls, copy. The comment at the top records what was verified live |
| [`server.js`](server.js) | The webhook: slots, the Basic Auth check, receipts |
| [`callback.test.ts`](callback.test.ts) | Unit tests for the webhook and the Response echo |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Docs notes (2026-11-16)

- The docs say only ports 80, 443, 8080, and 8443 are permitted. A callback on port 9999 still gets
  a 200 and a `request_id` at submission, so a bad port is not caught up front.
- The `callback_method` example sends `Content-Type: text/plain` with `--data 'Your Text.'` to
  `/v1/listen`, which reads like a text-to-speech example. Pre-recorded STT takes audio.

## Verified live

From the top of `index.tsx`:

```text
callback on Nova-3 pre-recorded: Deepgram answers the POST at once with only a request_id, then
delivers the transcript to the callback URL. The demo's server.js is that URL, and it checks the
Basic Auth credentials it put in the URL (the method the docs recommend).
Checked 2026-11-16 with the key: POST /v1/listen?model=nova-3&callback=https://example.com/... is 200
{"request_id": ...}; with deepgram:<password>@ in the URL, and with callback_method=put, also 200;
a localhost callback is 400 "Invalid callback URL."; Flux /v2/listen with callback is 400 at the
handshake. Not yet seen: a real delivery, and whether it carries the Authorization header. Those
need the deployed page (no request inspector was used).
Verified live 2026-11-16: pnpm verify:live POSTs Aura-2 speech of the phrase to /v1/listen?model=nova-3&smart_format=true&callback=https://example.com/stt-callback, with and without callback_method=put, and the prompt.md request with a granted token: each 200 with a request_id. Delivery not observed before deploy.
```

Not verified before deploy: a real delivery, its method, and whether it carries the
`Authorization` header. No request inspector was used. Check them on the deployed page: the
Response card shows all three.
