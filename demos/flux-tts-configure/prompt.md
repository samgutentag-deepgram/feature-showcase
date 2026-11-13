<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Flux TTS Configure to a web app with Deepgram

Pick a speed and the line starts over at it. On the Flux socket, speed is a Configure message, not part of the URL: the page sends it before the first turn, and Flux confirms it with ConfigureSuccess. In a live conversation you send the same message between turns, with no reconnect.

Build a page that speaks a line over one Deepgram text-to-speech socket, a turn at a time, with a
control the user can change while it talks. Live demo: https://dg-devrel-flux-tts-configure.fly.dev

## The connection

Open this socket. It is opened and run through every message below with a granted token before
this file ships.

```text
wss://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000
```

`flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
same request on `/v1/speak` is a 400.

## Speak a turn at a time

Split the line into short phrases, at commas as well as full stops, and send each as its own turn.
Before a turn, if the setting changed since the last one you sent, send it first:

```json
{"type":"Configure","speed":0.75}
```

Flux answers `ConfigureSuccess` and applies it from the next turn, with no reconnect. Configure sent
while a turn's text is already in does not change that turn, which is why the line is split.

```json
{"type":"Speak","text":"Your confirmation number is 4 7 2 9 1 8. "}
```

```json
{"type":"Flush"}
```

Each turn starts with `SpeechStarted` and its `speech_id`, streams its audio as binary frames, and
ends with `SpeechMetadata`: the same `speech_id`, `audio_duration_ms`, and
`billable_character_count`. Send the next turn when about a second of audio is left in your playback
queue. The server adds no space between turns, so end each one with a space. Keep the socket open
across turns; the voice carries its tone from one to the next.

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

Speak this, and change the setting while it talks:

> Your confirmation number is 4 7 2 9 1 8. Again, that is 4 7 2 9 1 8. In a minute, we will text you the same number, so keep it handy, in case you call us back. Your appointment is on Tuesday, at ten thirty in the morning, with Doctor Patel.

## Done when

- [ ] The socket URL and messages match the ones above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Changing the setting while it talks changes the next turn, with no reconnect and no gap.
- [ ] Socket errors and closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/flux-tts/client-messages
