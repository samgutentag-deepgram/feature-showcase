<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Clear the text-to-speech socket to a web app with Deepgram

No mic needed. Press Speak, then press Cut in (or the space bar) while the voice is still talking: it stands in for a caller talking over the agent. The page stops the audio it already has, sends Clear on the Aura-2 socket, and speaks "Sure, go ahead." on the same connection. The run card shows where the old line was at the cut: heard, already in the browser but never played, and still arriving. Try it with Clear, then without, and compare when the answer starts.

Build a page that speaks a line over a Deepgram text-to-speech socket, with a Cut in button that
works while the line is playing, the way a caller talks over a voice agent. Live demo: https://dg-devrel-demos.fly.dev/demos/tts-ws-clear/

## The connection

Open this socket. It is opened and run through every step below with a granted token before this
file ships.

```text
wss://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=24000
```

`aura-2-thalia-en` (thalia) is an Aura-2 voice, served on `/v1/speak`. Aura-2 only. Flux does not support Clear: on /v2/speak it is an error and the socket closes. Flux cuts in with Interrupt instead, shown in the text-to-speech interrupt demo.

Send the line as two text frames:

```json
{"type":"Speak","text":"Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with today? I can also update your address or change the delivery window."}
```

```json
{"type":"Flush"}
```

The server answers `Metadata` when the socket opens, streams the audio as binary frames, and ends
the line with `{"type":"Flushed","sequence_id":0}`. Each Flush you send gets the next
`sequence_id`.

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

Keep every queued `AudioBufferSourceNode` so you can stop them. Audio arrives faster than it plays
(about twice as fast, measured live on 2026-11-13), so at any moment some of the line is already in
the page but not yet heard.

## Cut in

When the user cuts in, stop every queued source in the page first, right away. Clear cannot take
back audio the server already sent: only the page can silence it. Then send, as a text frame:

```json
{"type":"Clear"}
```

The server drops the text and audio it has not sent yet and answers:

```text
{"type":"Cleared","sequence_id":0}
```

`sequence_id` counts the Clear messages on this socket: 0 for the first, 1 for the second. A few
binary frames of the old line can arrive between your Clear and `Cleared` (0.04 to 0.56 s of audio
in testing): throw away every binary frame until `Cleared` arrives. The old line never sends its
`Flushed`.

Then speak the answer on the same socket, no reconnect:

```json
{"type":"Speak","text":"Sure, go ahead."}
```

```json
{"type":"Flush"}
```

Measured live on 2026-11-13 with four Aura-2 voices, cutting 1.5 s into a 211-character line:
`Cleared` came back in 20 to 198 ms and the answer's first audio 96 to 198 ms after the cut. Without
Clear the rest of the old line (about 8 s of audio) streams first, and the answer waits behind it.
Send Clear before the answer's Speak, not after: a Clear sent after it clears the answer too.

## Try it

Speak this, and cut in a second or two into it:

> Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with today? I can also update your address or change the delivery window.

## Done when

- [ ] The socket URL and messages match the ones above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Cut in silences the audio at once, including what was already queued in the page.
- [ ] Binary frames between Clear and `Cleared` are dropped, and the answer starts in well under a second.
- [ ] Socket errors and closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/tts-ws-clear
