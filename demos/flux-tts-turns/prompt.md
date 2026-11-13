<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Flux TTS turns to a web app with Deepgram

A voice agent speaks in turns. Press Speak and the page sends the reply one sentence per turn on a single Flux socket. Each turn comes back with its own speech_id, how long the audio ran, and how many characters were billed.

Build a page that speaks a line over one Deepgram text-to-speech socket, a turn at a time, and lists what the server reports for each turn. Live demo: https://dg-devrel-flux-tts-turns.fly.dev

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
{"type":"Speak","text":"Thanks for calling Acme support. "}
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

Speak this:

> Thanks for calling Acme support. I can see your order right here. It shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with?

## Done when

- [ ] The socket URL and messages match the ones above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Every turn shows its speech_id, audio length and billable characters.
- [ ] Socket errors and closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/flux-tts/state
