<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Flux TTS session totals to a web app with Deepgram

Press Speak and the reply goes out a sentence per turn on one Flux socket. When the last turn is done, the page sends Close, and Flux answers with SessionMetadata: the total audio and billable characters for the whole session, set against the sum of the turns. Flux voices only.

Build a page that speaks a line over one Deepgram text-to-speech socket, a turn at a time, and lists what the server reports for each turn. Live demo: https://dg-devrel-demos.fly.dev/demos/flux-tts-session-metadata/

## The connection

Open this socket. It is opened and run through every message below with a granted token before
this file ships.

```text
wss://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000
```

`flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
same request on `/v1/speak` is a 400.

## Speak a turn at a time

Split the line into sentences and send each as its own turn.
```json
{"type":"Speak","text":"Got it, one large pepperoni and a side salad. "}
```

```json
{"type":"Flush"}
```

Each turn starts with `SpeechStarted` and its `speech_id`, streams its audio as binary frames, and
ends with `SpeechMetadata`: the same `speech_id`, `audio_duration_ms`, and
`billable_character_count`. Send the next turn when about a second of audio is left in your playback
queue. The server adds no space between turns, so end each one with a space. Keep the socket open
across turns; the voice carries its tone from one to the next.

## Close the session and read the totals

After the last turn's `SpeechMetadata`, send:

```json
{"type":"Close"}
```

Flux answers with one last message, `SessionMetadata`, then closes the socket with code 1000:
`total_audio_duration_ms`, `total_input_character_count`, and `total_billable_character_count`
for every turn on the socket. In testing, each total equaled the sum of the turns' `SpeechMetadata`. Closing the
socket yourself, without `Close`, gets no `SessionMetadata`. Flush the last turn before you send
`Close`.

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

Speak this:

> Got it, one large pepperoni and a side salad. Your total comes to twenty four dollars. It will be ready for pickup in about twenty minutes.

## Done when

- [ ] The socket URL and messages match the ones above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Every turn shows its speech_id, audio length and billable characters.
- [ ] After the last turn, Close is sent and the page shows the totals from `SessionMetadata` next to the sum of the turns.
- [ ] Socket errors and closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/flux-tts/server-messages
