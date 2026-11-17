<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Finalize to a web app with Deepgram

Read the line, then press Finalize now the moment you stop. Deepgram turns what it is holding into a final result right away, instead of waiting out a second of silence. Run it again without the button to compare.

Build a page with a mic button that streams speech to Deepgram and shows the final transcript,
with `endpointing` set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/finalize/

## The request

Every URL here is opened against the live API before this file ships.

### Use Nova-3: `/v1/listen`

Nova-3 only. Flux does not support Finalize yet: /v2/listen answers it with an Error and closes the socket. Flux ends a turn early with its own ForceEndTurn message instead (see the flux-force-end-turn demo).


The params that matter, as a reader would copy them:

```
/v1/listen?model=nova-3&endpointing=1000
```

The exact URL to open, with the audio format appended:

```
wss://api.deepgram.com/v1/listen?model=nova-3&endpointing=1000&interim_results=true&encoding=linear16&sample_rate=16000
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

## Mid-stream messages

While the socket is open, these go on it as text frames, one per button. Each is sent live before
this file ships.

**Finalize now**

```json
{
  "type": "Finalize"
}
```

Comes back: `Results from_finalize`.

## Try it

Read this aloud:

> Book a table for four at seven thirty tonight, by the window.

## Done when

- [ ] The page streams the mic to the URL above, with `endpointing` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Reading the phrase above shows the difference the feature makes, in the final transcript.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/finalize
