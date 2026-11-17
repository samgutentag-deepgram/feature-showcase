<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Nova-3 Medical to a web app with Deepgram

Read a short medication list out loud. Run it on plain nova-3, then on nova-3-medical, and compare how each writes down the drug names and doses.

Build a page with a mic button that streams speech to Deepgram and shows the final transcript,
with `model` set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/nova3-medical/

## The request

Every URL here is opened against the live API before this file ships.

### Use Nova-3: `/v1/listen`

Nova-3 only. Flux does not support a medical model yet (/v2/listen answers model=nova-3-medical with a 400).


The params that matter, as a reader would copy them:

```
/v1/listen?model=nova-3-medical
```

The exact URL to open, with the audio format appended:

```
wss://api.deepgram.com/v1/listen?model=nova-3-medical&interim_results=true&encoding=linear16&sample_rate=16000
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

> The patient takes lisinopril 10 milligrams and metformin 500 milligrams daily. Start atorvastatin 40 milligrams, amoxicillin-clavulanate 875 milligrams twice daily, and levothyroxine 50 micrograms.

## Done when

- [ ] The page streams the mic to the URL above, with `model` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Reading the phrase above shows the difference the feature makes, in the final transcript.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/model
