<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Stream LLM tokens to text-to-speech to a web app with Deepgram

The reply below arrives a word at a time, the way an LLM streams it. Hear it three ways: wait for the whole reply first, send each token to Flux as it arrives, or stream the tokens but forget to Flush. Watch when the first audio plays, and how much was out before Flush.

Build a page that speaks an LLM's reply over a Deepgram text-to-speech socket while the reply is
still arriving, a token at a time. Live demo: https://dg-devrel-tts-ws-flush.fly.dev

## The connection

Open this socket. It is opened and run through every message below with a granted token before
this file ships.

```text
wss://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000
```

`flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
same request on `/v1/speak` is a 400.

## Send tokens as they arrive

Don't wait for the whole reply. Send each token from your LLM as it comes, as its own text frame,
exactly as it came (Flux adds no spaces between them):

```json
{"type":"Speak","text":"Sure, "}
```

The moment the reply is done, end the turn:

```json
{"type":"Flush"}
```

Flux starts speaking before the text is complete: measured live on 2026-11-12, with a token every
60 ms the first audio came 467 ms after the first token, and 2.15 s of an 8.16 s reply was already
out before Flush. It holds back the tail of the reply until Flush, though: with Flush sent
3 s late, the last 3.85 s waited for it. So flush as soon as the last token is in.

The turn ends with `SpeechMetadata`.

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

Stream this reply in, a word every 60 ms:

> Sure, I can help with that. Your order shipped this morning, and it should arrive by Thursday. I will text you the tracking number in a minute, so keep an eye on your phone.

## Done when

- [ ] The first audio plays while the reply is still arriving.
- [ ] Flush goes out the moment the last token is in.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Socket errors and closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/flux-tts/client-messages
