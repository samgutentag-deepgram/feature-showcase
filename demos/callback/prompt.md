<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Callback to a web app with Deepgram

Record a line. Deepgram answers the POST at once with a request_id, then delivers the transcript to a webhook on this page's server, which checks the Basic Auth password it put in the callback URL.

Build a page that records a few seconds from the mic and sends it
to Deepgram's pre-recorded endpoint with `callback`, `callback_method` set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/callback/

## The request

Nova-3 only. Flux does not support callback yet (/v2/listen answers it with a 400).

This param works on pre-recorded audio only, so the clip goes in one POST. The request is sent
against the live API before this file ships.

```http
POST https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&callback=https%3A%2F%2F%3Cthis+page%3E%2Fapi%2Fcallback%2F%3Cid%3E
Authorization: Bearer <token from /api/token>
Content-Type: audio/wav

<the audio bytes>
```

## Keep the API key on your server

The browser never sees `DEEPGRAM_API_KEY`. Add one server route, `GET /api/token`, that asks
Deepgram for a short-lived token and returns it as plain text:

```http
POST https://api.deepgram.com/v1/auth/grant
Authorization: Token <DEEPGRAM_API_KEY>
Content-Type: application/json

{"ttl_seconds": 30}
```

The response is JSON with `access_token`. The key needs the Member role or above. A token only
has to live long enough to open the socket; an open socket outlives it. Refuse the route to other
sites: answer 403 when `Sec-Fetch-Site` is present and not `same-origin`.

In the browser, fetch a fresh token for every session and send it as `Authorization: Bearer <token>`. Deepgram answers CORS
for browser requests.

## Record the mic

Capture the mic at 16 kHz mono, 16-bit PCM, keep the chunks until the visitor stops
(cap it at 30 s), and wrap them in a 44-byte WAV header. With the header, the POST needs no
`encoding` or `sample_rate`.

## Read the result

The response is JSON. The transcript is in `results.channels[0].alternatives[0].transcript`, with
one entry per word in `words` (`speaker` on each when diarizing, one channel per entry in
`channels` with `multichannel=true`).

## Receive the callback

With `callback`, Deepgram answers the POST at once with only `{"request_id": ...}` and later
POSTs the full transcript JSON to that URL. It must be a public HTTPS URL on your server (a
localhost URL is refused with a 400, "Invalid callback URL"). Store the JSON by job id and let the
page poll for it.

## Try it

Read this aloud:

> Send this to my server when it is ready. I will not wait for the answer.

## Done when

- [ ] The page POSTs the clip to the URL above, with `callback`, `callback_method` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] The result shows the fields the feature adds.
- [ ] Errors show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/callback
