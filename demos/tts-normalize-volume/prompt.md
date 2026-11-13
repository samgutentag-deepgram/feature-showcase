<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Text-to-speech volume normalization to a web app with Deepgram

Press Speak and the same line plays in five Flux voices, back to back. Turn normalization off and some voices come out quieter than others, and the same voice can change level from one call to the next. Turn it on and they all land within a dB or two. The page measures each one as it plays. Flux TTS only.

Build a page with a text box and a Speak button that sends the text to Deepgram text-to-speech and
plays the audio. Live demo: https://dg-devrel-demos.fly.dev/demos/tts-normalize-volume/

## The request

This exact request is sent to the live API before this file ships and comes back 200 with audio.

```http
POST https://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000&container=none&normalize_volume=true
Authorization: Bearer <token from /api/token>
Content-Type: application/json

{"text":"Your table for four is ready. Please head to the host stand by the front door."}
```

The feature is `normalize_volume=true`. `flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
same request on `/v1/speak` is a 400.

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

In the browser, fetch a fresh token for every request and send it as
`Authorization: Bearer <token>`.

## Play the audio

There is no container, so there is nothing to wait for: play the audio as it arrives. The bytes are
16-bit signed little-endian PCM at 24 kHz mono. A chunk can end halfway through a
sample: hold the odd byte and put it in front of the next chunk. Turn each chunk into an `AudioBuffer` and queue it on one `AudioContext` so the
pieces play back to back.

## Try it

Speak:

> Your table for four is ready. Please head to the host stand by the front door.
> Thanks for calling. Your order shipped this morning and should arrive on Thursday.
> Your prescription is ready. You can pick it up at the pharmacy counter after two.

## Done when

- [ ] The request matches the one above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] A failed request shows a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/reference/speak/v-2/audio/generate
