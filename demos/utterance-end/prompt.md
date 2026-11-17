<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Utterance end to a web app with Deepgram

Read the phrase with a long pause in the middle. Nova-3 sends speech_final the moment you go quiet. With utterance_end_ms set, it also sends UtteranceEnd, but only once the gap after your last word is at least that long. Try 1000 ms, then 2500 ms, and compare where each one lands.

Build a page with a mic button that streams speech to Deepgram and shows the final transcript,
with `utterance_end_ms`, `interim_results` set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/utterance-end/

## The request

Every URL here is opened against the live API before this file ships.

### Use Nova-3: `/v1/listen`

Nova-3 only. Flux does not support utterance_end_ms yet (/v2/listen answers it with a 400). Flux ends turns on its own with EndOfTurn.


The params that matter, as a reader would copy them:

```
/v1/listen?model=nova-3&interim_results=true&utterance_end_ms=1000
```

The exact URL to open, with the audio format appended:

```
wss://api.deepgram.com/v1/listen?model=nova-3&interim_results=true&utterance_end_ms=1000&encoding=linear16&sample_rate=16000
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

- Nova-3 (`/v1/listen`): a message with `"type": "Results"` and `"is_final": true` carries it in `channel.alternatives[0].transcript`.

## Stop without losing the last words

- Nova-3: send `{"type": "CloseStream"}` as a text frame and wait for the socket to close; the last final results arrive first.

## Try it

Read this aloud:

> I want to book a table for…
> (pause for a slow count of two)
> …four people tomorrow night.
> (then stay quiet for three seconds)

## Done when

- [ ] The page streams the mic to the URL above, with `utterance_end_ms`, `interim_results` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Reading the phrase above shows the difference the feature makes, in the final transcript.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/utterance-end
