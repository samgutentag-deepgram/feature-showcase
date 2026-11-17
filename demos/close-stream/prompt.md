<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Close stream to a web app with Deepgram

Read the line, and while you are still saying the last words, press CloseStream or Hang up. CloseStream asks Deepgram to finish what it has before it closes. Hang up drops the socket, and whatever was still in flight never comes back. Do it once each way and compare.

Build a page with a mic button that streams speech to Deepgram and shows the final transcript,
with  set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/close-stream/

## The request

Every URL here is opened against the live API before this file ships.

### Use Flux: `/v2/listen`

On Flux, CloseStream decodes the audio already sent (an Update, if any was left) and closes with no status code. It does not end the turn and sends no Metadata, so press ForceEndTurn first, then CloseStream.


The params that matter, as a reader would copy them:

```
/v2/listen?model=flux-general-en
```

The exact URL to open, with the audio format appended:

```
wss://api.deepgram.com/v2/listen?model=flux-general-en&encoding=linear16&sample_rate=16000
```

### Or Nova-3: `/v1/listen`

On Nova-3, CloseStream flushes: the last words come back final, then Metadata, then a 1000 close.


The params that matter, as a reader would copy them:

```
/v1/listen?model=nova-3
```

The exact URL to open, with the audio format appended:

```
wss://api.deepgram.com/v1/listen?model=nova-3&interim_results=true&encoding=linear16&sample_rate=16000
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
- Nova-3 (`/v1/listen`): a message with `"type": "Results"` and `"is_final": true` carries it in `channel.alternatives[0].transcript`.

## Stop without losing the last words

- Flux: send `{"type": "ForceEndTurn"}` as a text frame, wait for the `EndOfTurn` it produces, then send `{"type": "CloseStream"}`. `CloseStream` alone closes at once and drops a turn still in progress.
- Nova-3: send `{"type": "CloseStream"}` as a text frame and wait for the socket to close; the last final results arrive first.

## Mid-stream messages

While the socket is open, these go on it as text frames, one per button. Each is sent live before
this file ships.

**ForceEndTurn**

```json
{
  "type": "ForceEndTurn"
}
```

Comes back: `EndOfTurn`.

**CloseStream**

```json
{
  "type": "CloseStream"
}
```

After this, stop the mic and wait for the socket to close. Nothing comes back; the socket stays open.

## Try it

Read this aloud twice: once without , once with:

> Please ship the blue order to the warehouse in Portland on Tuesday morning.
> (press CloseStream or Hang up while you say "Tuesday morning", or ForceEndTurn and then CloseStream)

## Done when

- [ ] The page streams the mic to the URL above, with  exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Reading the phrase above shows the difference the feature makes, in the final transcript.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/close-stream
