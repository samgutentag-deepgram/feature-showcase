<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Flux end-of-turn timeout to a web app with Deepgram

Start a sentence, trail off, and stay quiet. eot_timeout_ms is the most silence Flux allows before it ends the turn anyway, sure or not. Every EndOfTurn says why it ended: trigger "model" when Flux decided you were done, "timeout" when the clock ran out.

Build a page with a mic button that streams speech to Deepgram and shows the final transcript,
with `eot_timeout_ms` set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/flux-eot-timeout/

## The request

Every URL here is opened against the live API before this file ships.

### Use Flux: `/v2/listen`

Flux only. eot_timeout_ms is a Flux turn setting; Nova-3 ends turns on silence with endpointing.


The params that matter, as a reader would copy them:

```
/v2/listen?model=flux-general-en&eot_threshold=0.7&eot_timeout_ms=3000
```

The exact URL to open, with the audio format appended:

```
wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=0.7&eot_timeout_ms=3000&encoding=linear16&sample_rate=16000
```

Send repeated params once per value (`keyterm=a&keyterm=b`), never comma-joined. Build the query with
`URLSearchParams` and `append`, which encodes a space in a value as `+`.

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

In the browser, fetch a fresh token for every session and open the socket with it as a
subprotocol: `new WebSocket(url, ['bearer', token])`.

## Capture the mic

Use `getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })`
and an AudioWorklet that downsamples to 16 kHz mono and converts to 16-bit signed
little-endian PCM. Send each chunk (about 100 ms) as a binary WebSocket frame. Raw PCM has no
header, which is why the request names `encoding=linear16` and `sample_rate=16000`.

## Read the transcript

- Flux (`/v2/listen`): a message with `"type": "TurnInfo"` and `"event": "EndOfTurn"` carries the finished turn in `transcript`.

## Stop without losing the last words

- Flux: send `{"type": "ForceEndTurn"}` as a text frame, wait for the `EndOfTurn` it produces, then send `{"type": "CloseStream"}`. `CloseStream` alone closes at once and drops a turn still in progress.

## Try it

Read this aloud:

> So I was thinking that maybe we could…
> (then stop, and stay quiet until the turn ends)

## Done when

- [ ] The page streams the mic to the URL above, with `eot_timeout_ms` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Reading the phrase above shows the difference the feature makes, in the final transcript.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/flux/configuration
