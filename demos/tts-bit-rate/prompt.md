<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Text-to-speech bit rate to a web app with Deepgram

Press Speak, then pick a bit rate any time: the line starts over at that size. Each run shows the real bytes Deepgram sent back, and the last two sit side by side. Go low and listen for the voice to go thin; watch the spectrum lose its top end on MP3.

Build a page with a text box and a Speak button that sends the text to Deepgram text-to-speech and
plays the audio. Live demo: https://dg-devrel-demos.fly.dev/demos/tts-bit-rate/

## The request

This exact request is sent to the live API before this file ships and comes back 200 with audio.

```http
POST https://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=mp3&bit_rate=32000
Authorization: Bearer <token from /api/token>
Content-Type: application/json

{"text":"Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. The tracking number is in your email, and if you are not home, the driver will leave it at the front desk."}
```

The feature is `encoding=mp3`, `bit_rate=32000`. `flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
same request on `/v1/speak` is a 400. Aura-2 voices such as `aura-2-thalia-en` go to `/v1/speak` with the same query.

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

The response is an MP3 file (`audio/mpeg`), compressed to the `bit_rate` you asked for. Read the whole body, then
`AudioContext.decodeAudioData` it and play the buffer. Its byte length is the size you would store
or send on.

## Try it

Speak:

> Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. The tracking number is in your email, and if you are not home, the driver will leave it at the front desk.
> She sells seashells by the seashore, and the shells she sells are surely seashells. So if she sells shells on the seashore, I am sure she sells seashore shells.
> Your verification code is 5 0 9 2 7 1. Six sixty six Fifth Avenue, suite 1450. Please have your fax number ready.

## Done when

- [ ] The request matches the one above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] A failed request shows a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/tts-bit-rate
