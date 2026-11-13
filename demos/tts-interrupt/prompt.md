<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Text-to-speech interrupt to a web app with Deepgram

Press Speak, then talk over the agent while it is still talking, the way a caller would. Flux speech-to-text hears you start, the page cuts in, and the agent answers "Sure, go ahead." Try it with Interrupt, then with the audio stopped in the browser only, and compare how long the answer takes. Flux also says which words you heard.

Build a page that speaks a line over a Deepgram text-to-speech socket, with a Cut in button that
works while the line is playing, the way a caller talks over a voice agent. Live demo: https://dg-devrel-tts-interrupt.fly.dev

## The connection

Open this socket. It is opened and run through every step below with a granted token before this
file ships.

```text
wss://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000
```

`flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
same request on `/v1/speak` is a 400. Aura-2 voices such as `aura-2-thalia-en` go to `/v1/speak` with the same query.

Send the line as two text frames:

```json
{"type":"Speak","text":"Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with today? I can also update your address or change the delivery window."}
```

```json
{"type":"Flush"}
```

Flux answers `SpeechStarted` with a `speech_id`, streams the audio as binary frames, and ends the
turn with `SpeechMetadata`.

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

Count how many milliseconds of audio have actually played since the socket opened. That is your
playback position, and Cut in needs it.

## Hear the user cut in

While the line plays, stream the mic (16 kHz mono 16-bit PCM, about 100 ms a frame, with
`echoCancellation: true`) to Flux speech-to-text on a second socket, opened the same way:

```text
wss://api.deepgram.com/v2/listen?model=flux-general-en&encoding=linear16&sample_rate=16000
```

When a `TurnInfo` message arrives with `"event": "StartOfTurn"`, the user has started talking:
cut in. Flux sends it about half a second into the speech. Keep a button as well, for people
without a mic. Without headphones the mic can hear the voice itself, so test with them first.

## Cut in

When the user cuts in, stop playback in the page first, right away: don't wait for the server. Then
send, as a text frame:

```json
{"type":"Interrupt","playback_offset":{"type":"time_ms","value":1000}}
```

`value` is your playback position in ms (1000 here), counted from the start of the
session, not the turn, so each Interrupt's value must be larger than the last. Flux stops the turn
and answers `SpeechInterrupted` with `text_spoken` (the words the user heard) and
`text_remaining` (the ones they didn't). In a voice agent, put `text_spoken` in the LLM context as
the assistant's turn. Throw away binary frames until the next `SpeechStarted`: they belong to the
interrupted line.

Then speak the answer on the same socket, no reconnect:

```json
{"type":"Speak","text":"Sure, go ahead."}
```

```json
{"type":"Flush"}
```

Measured live on 2026-11-12: with Interrupt the answer started 235-272 ms after the cut. Without it the
rest of the old line streams first, and the answer waits several seconds behind it.

On `/v1/speak` (Aura-2) there is no Interrupt: send `{"type":"Clear"}` instead and throw away
binary frames until `Cleared` arrives. There is no `text_spoken`.

## Try it

Speak this, and cut in a second or two into it:

> Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with today? I can also update your address or change the delivery window.

## Done when

- [ ] The socket URL and messages match the ones above, apart from the text and the playback position.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Cut in silences the audio at once, and the answer starts in well under a second.
- [ ] After a cut, `text_spoken` matches what you heard.
- [ ] Socket errors and closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/flux-tts/interrupt-handling
