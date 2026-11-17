<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Utterances to a web app with Deepgram

Record the lines below with a pause of about a second, then a longer one. Deepgram returns results.utterances: timed rows, each with a transcript and a confidence. Pick utt_split, the pause in seconds that starts a new row, then record again with another value and compare where the splits land.

Build a page that records a few seconds from the mic and sends it
to Deepgram's pre-recorded endpoint with `utterances`, `utt_split` set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/utterances/

## The request

Nova-3 only. Flux does not support utterances or utt_split yet (/v2/listen answers them with a 400). Pre-recorded only: the streaming socket takes the params but never sends utterances back, so Record keeps up to 30 seconds and sends one POST. In testing, values under 0.8 split in the same places as 0.8.

This param works on pre-recorded audio only, so the clip goes in one POST. The request is sent
against the live API before this file ships.

```http
POST https://api.deepgram.com/v1/listen?model=nova-3&punctuate=true&utterances=true&utt_split=1.5
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

## Try it

Read this aloud:

> The package left the warehouse this morning. (pause, about a second) It should arrive on Friday. (long pause, count to two) Please sign for it at the front desk.

## Done when

- [ ] The page POSTs the clip to the URL above, with `utterances`, `utt_split` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] The result shows the fields the feature adds.
- [ ] Errors show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/utterances
