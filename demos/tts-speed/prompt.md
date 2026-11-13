<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Text-to-speech speed to a web app with Deepgram

Press Speak, then pick a speed any time: the line starts over at that pace. Slow it down for a confirmation number someone has to write down, speed it up for the disclaimer nobody wants to sit through. Same voice, same words.

Build a page with a text box and a Speak button that sends the text to Deepgram text-to-speech and
plays the audio. Live demo: https://dg-devrel-tts-speed.fly.dev

## The request

This exact request is sent to the live API before this file ships and comes back 200 with audio.

```http
POST https://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000&container=none&speed=0.85
Authorization: Bearer <token from /api/token>
Content-Type: application/json

{"text":"Your confirmation number is 4 7 2 9 1 8. Again, that is 4 7 2 9 1 8. In a minute, we will text you the same number, so keep it handy, in case you call us back."}
```

The feature is `speed=0.85`. `flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
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

There is no container, so there is nothing to wait for: play the audio as it arrives. The bytes are
16-bit signed little-endian PCM at 24 kHz mono. A chunk can end halfway through a
sample: hold the odd byte and put it in front of the next chunk. Turn each chunk into an `AudioBuffer` and queue it on one `AudioContext` so the
pieces play back to back.

## Try it

Speak:

> Your confirmation number is 4 7 2 9 1 8. Again, that is 4 7 2 9 1 8. In a minute, we will text you the same number, so keep it handy, in case you call us back.
> This call may be recorded, for quality and training purposes. Message and data rates may apply. This offer is for new customers only, terms and conditions apply, and the details are on our website.
> Take one tablet twice a day, with food, and never on an empty stomach. If you feel dizzy, sit down, and drink some water. If the dizziness lasts more than a day, call your doctor.

## Done when

- [ ] The request matches the one above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] A failed request shows a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/tts-voice-controls
