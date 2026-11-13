<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Text-to-speech expressivity to a web app with Deepgram

Press Speak, then pick a register any time, from calmest to liveliest: the line starts over with it. Same Flux voice, same words. Expressivity is in beta. Normal (0) is the tuned default, and the far ends can drop or repeat a word, so listen before you ship one.

Build a page with a text box and a Speak button that sends the text to Deepgram text-to-speech and
plays the audio. Live demo: https://dg-devrel-tts-expressivity.fly.dev

## The request

This exact request is sent to the live API before this file ships and comes back 200 with audio.

```http
POST https://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000&container=none&expressivity=-1
Authorization: Bearer <token from /api/token>
Content-Type: application/json

{"text":"Great news, your refund went through this morning! You should see it in your account by Friday, and there is nothing else you need to do. Thanks for sticking with us!"}
```

The feature is `expressivity=-1`. `flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
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

> Great news, your refund went through this morning! You should see it in your account by Friday, and there is nothing else you need to do. Thanks for sticking with us!
> I am sorry, I know this has been frustrating. Let me take a look at your account, and I will stay with you until it is fixed. Take your time, there is no rush.
> Welcome back! It has been a while. Your favorite table is open tonight, at seven thirty, and the chef has a new dessert you are going to love.

## Done when

- [ ] The request matches the one above, apart from the text.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] A failed request shows a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/tts-expressivity
