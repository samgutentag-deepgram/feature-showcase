<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Diarizer v1 vs v2 to a web app with Deepgram

Send one short support call through the v1 diarizer, then v2, and compare who Deepgram says spoke each line. The sample is synthetic: two Deepgram text-to-speech voices, six turns.

Build a page that takes a short audio clip and sends it
to Deepgram's pre-recorded endpoint with `diarize_model` set as below. Live demo: https://dg-devrel-demos.fly.dev/demos/diarize-model-v2/

## The request

Nova-3 only. Flux does not support diarize_model yet (/v2/listen answers it with a 400). diarize_model=v2 is pre-recorded only, so every run here is one POST.

This param works on pre-recorded audio only, so the clip goes in one POST. The request is sent
against the live API before this file ships.

```http
POST https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&diarize_model=latest
Authorization: Bearer <token from /api/token>
Content-Type: audio/wav

<the audio bytes>
```

## Keep the API key on your server

The browser never sees `DEEPGRAM_API_KEY`. Add one server route, `GET /api/token`, that asks
Deepgram for a short-lived token and returns it as plain text:

```http
POST https://api.deepgram.com/v1/auth/grant
Authorization: Token <DEEPGRAM_API_KEY>
Content-Type: application/json

{"ttl_seconds": 30}
```

The response is JSON with `access_token`. The key needs the Member role or above. A token only
has to live long enough to open the socket; an open socket outlives it. Refuse the route to other
sites: answer 403 when `Sec-Fetch-Site` is present and not `same-origin`.

In the browser, fetch a fresh token for every session and send it as `Authorization: Bearer <token>`. Deepgram answers CORS
for browser requests.

## Read the result

The response is JSON. The transcript is in `results.channels[0].alternatives[0].transcript`, with
one entry per word in `words` (`speaker` on each when diarizing, one channel per entry in
`channels` with `multichannel=true`).

## Done when

- [ ] The page POSTs the clip to the URL above, with `diarize_model` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] The result shows the fields the feature adds.
- [ ] Errors show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/diarization
