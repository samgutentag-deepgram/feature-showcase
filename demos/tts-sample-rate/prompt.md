<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Text-to-speech sample rate to a web app with Deepgram

Press Speak, then pick a sample rate any time: the line starts over at that rate, still 16-bit linear PCM. Listen for the hiss in "s" sounds, and compare the size on the last two runs. Each rate keeps detail up to half its value, and bytes grow with it: 16,000 a second at 8 kHz, 96,000 at 48 kHz. The spectrum stops at 12 kHz, so 24 and 48 look alike there; the difference is in your ear and the file size.

Build a page with a text box and a Speak button that sends the text to Deepgram text-to-speech and
plays the audio. Live demo: https://dg-devrel-demos.fly.dev/demos/tts-sample-rate/

## The request

This exact request is sent to the live API before this file ships and comes back 200 with audio.

```http
POST https://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=16000&container=none
Authorization: Bearer <token from /api/token>
Content-Type: application/json

{"text":"She sells seashells by the seashore, and the shells she sells are surely seashells. So if she sells shells on the seashore, I am sure she sells seashore shells."}
```

The feature is `sample_rate=16000`. `flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
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
16-bit signed little-endian PCM at 16 kHz mono. A chunk can end halfway through a
sample: hold the odd byte and put it in front of the next chunk. Turn each chunk into an `AudioBuffer` and queue it on one `AudioContext` so the
pieces play back to back.

## Try it

Speak:

> She sells seashells by the seashore, and the shells she sells are surely seashells. So if she sells shells on the seashore, I am sure she sells seashore shells.
> Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. The tracking number is in your email.
> Sixty-six silver spoons sat in the sink, so Max scrubbed them, rinsed them, and stacked them on the shelf by the stove.

## Done when

- [ ] The request matches the one above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] A failed request shows a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/tts-sample-rate
