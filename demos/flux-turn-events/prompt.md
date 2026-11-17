<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Flux turn events to a web app with Deepgram

Say two short sentences with a pause between them. Flux answers with TurnInfo events: StartOfTurn when you begin, Update about every quarter second, and EndOfTurn when it decides you are done. Each event carries a turn_index, and the diagram follows the state Flux is in.

Build a page with a mic button that streams speech to Deepgram and shows the final transcript,
with `eot_threshold` set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/flux-turn-events/

## The request

Every URL here is opened against the live API before this file ships.

### Use Flux: `/v2/listen`

Flux only. TurnInfo events come on every /v2/listen socket; no param turns them on. Nova-3 has no turn events.


The params that matter, as a reader would copy them:

```
/v2/listen?model=flux-general-en&eot_threshold=0.7
```

The exact URL to open, with the audio format appended:

```
wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=0.7&encoding=linear16&sample_rate=16000
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

> My name is Sam.
> (pause for two seconds)
> I need a table for two.

## Done when

- [ ] The page streams the mic to the URL above, with `eot_threshold` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Reading the phrase above shows the difference the feature makes, in the final transcript.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/flux/state
