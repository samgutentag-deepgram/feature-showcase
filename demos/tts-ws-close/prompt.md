<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Graceful close for text-to-speech sockets to a web app with Deepgram

Press Speak. The page sends the line, then closes the socket 600 ms later, while the audio is still coming, the way an app hangs up once it has sent its last words. Send Close and Deepgram finishes the line before it closes. Drop the socket and you hear only what arrived in time. Try both and compare the two runs.

Build a page that speaks a line over a Deepgram text-to-speech socket and then closes the socket
without cutting off the end of the line. Live demo: https://dg-devrel-demos.fly.dev/demos/tts-ws-close/

## The connection

Open this socket. It is opened and run through every message below with a granted token before
this file ships.

```text
wss://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000
```

`flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
same request on `/v1/speak` is a 400. Aura-2 voices such as `aura-2-thalia-en` go to `/v1/speak` with the same query.

Send the line as a text frame:

```json
{"type":"Speak","text":"Your order shipped this morning, and it should arrive by Thursday. I will text you the tracking number in a minute, so keep an eye on your phone. Is there anything else I can help you with today?"}
```

## Close it the graceful way

When you have sent your last line, don't call `ws.close()`. Send this text frame instead, even
while audio is still arriving:

```json
{"type":"Close"}
```

Deepgram finishes the text it already has, streams the rest of the audio, and then closes the
socket itself with code 1000. You don't need a Flush first. Keep handling binary frames until the
socket closes, and play every one. On `/v2/speak` (Flux), `SpeechMetadata` and then
`SessionMetadata` (with `total_billable_character_count`) arrive just before the close; on
`/v1/speak` (Aura-2) no message comes, only the audio and the close.

Measured live on 2026-11-13, with the close sent 600 ms after the line: Close delivered the whole
line on both endpoints (9.2-9.9 s of Flux audio after Close). Closing the socket from the client
instead kept only what had arrived, 0.6-1.7 s of audio, and the rest was lost.

## Keep the API key on your server

The browser never sees `DEEPGRAM_API_KEY`. Add one server route, `GET /api/token`, that asks
Deepgram for a short-lived token and returns it as plain text:

```http
POST https://api.deepgram.com/v1/auth/grant
Authorization: Token <DEEPGRAM_API_KEY>
Content-Type: application/json

{"ttl_seconds": 30}
```

The response is JSON with `access_token`. The key needs the Member role or above. Refuse the route
to other sites: answer 403 when `Sec-Fetch-Site` is present and not `same-origin`.

In the browser, fetch a fresh token for every session and open the socket with it as a
subprotocol: `new WebSocket(url, ['bearer', token])`. A token only has to live long enough to
open the socket; an open socket outlives it.

## Play the audio

There is no container, so there is nothing to wait for: play the audio as it arrives. The bytes are
16-bit signed little-endian PCM at 24 kHz mono. A chunk can end halfway through a
sample: hold the odd byte and put it in front of the next chunk. Turn each chunk into an `AudioBuffer` and queue it on one `AudioContext` so the
pieces play back to back.

## Try it

Speak this, and send Close half a second later:

> Your order shipped this morning, and it should arrive by Thursday. I will text you the tracking number in a minute, so keep an eye on your phone. Is there anything else I can help you with today?

## Done when

- [ ] The socket URL and messages match the ones above, apart from the text.
- [ ] The whole line plays even though Close went out while the audio was still arriving.
- [ ] The page waits for the server to close the socket (1000) instead of closing it first.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Socket errors and closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/tts-ws-close
