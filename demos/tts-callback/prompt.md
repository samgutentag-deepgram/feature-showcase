<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add Text-to-speech callback to a web app with Deepgram

Press Speak. Deepgram answers at once with a request_id and no audio, makes the speech, then sends the file to this page's server as a webhook. Pick PUT to have it delivered by PUT, or Low priority to queue it as a batch job on Flux, where Deepgram fetches the text from a URL instead of the request body.

Build a page with a text box and a Speak button that asks Deepgram text-to-speech for the audio by
callback: Deepgram answers at once with a `request_id`, makes the audio, and sends it to a webhook on
your server, which the page then plays. Live demo: https://dg-devrel-demos.fly.dev/demos/tts-callback/

## The request

This exact request, with a real webhook URL in place of the example one, is sent to the live API
before this file ships and comes back 200 with a `request_id`.

```http
POST https://api.deepgram.com/v2/speak?model=flux-wes-en&encoding=linear16&sample_rate=24000&container=wav&callback=https%3A%2F%2Fyour-app.example.com%2Fapi%2Ftts-callback%2F%3Cjob+id%3E&callback_method=put
Authorization: Bearer <token from /api/token>
Content-Type: application/json

{"text":"Hi Dana, this is a reminder from Bayside Dental. Your cleaning is on Thursday at 2 30 in the afternoon. Reply yes to confirm, or call us to move it."}
```

The feature is `callback=https://your-app.example.com/api/tts-callback/<job id>`, `callback_method=put`. `flux-wes-en` (wes) is a Flux voice: Flux voices are served on `/v2/speak` only, and the
same request on `/v1/speak` is a 400. Aura-2 voices such as `aura-2-thalia-en` go to `/v1/speak` with the same query.

The response holds no audio, only `{"request_id": "..."}`. `callback_method` is `post` (the default)
or `put`, lowercase. With `priority=low` the body becomes `{"url": ...}`, a URL Deepgram fetches the text from.

## The webhook

Deepgram must reach it from the internet: `http` or `https`, on port 80, 443, 8080, or 8443. It
cannot reach `localhost`, so use your deployed URL or a tunnel while you build.

1. Before calling Deepgram, make a job: a random id, the text, and a created time, in memory. Put the
   id in the webhook path, because the delivery carries no `request_id` to match on.
2. Accept `PUT /api/tts-callback/:id`. The body is the audio file itself (`content-type:
   audio/wav` for the request above), not JSON. Store it on the job and answer 200. Any other
   status makes Deepgram retry, up to 10 times, 30 seconds apart.
3. Refuse anything that is not a job you made: unknown ids get a 404, a second delivery is ignored,
   and the body is capped (2 MB covers 400 characters of 24 kHz speech). Drop jobs after 10 minutes.

The page polls its own server (`GET /api/tts-callback/:id`, once a second, same-origin only) until
the audio is in, then plays it.

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

What the page gets from its own server is the WAV file Deepgram delivered. `AudioContext.decodeAudioData`
it and play the buffer.

## Try it

Speak:

> Hi Dana, this is a reminder from Bayside Dental. Your cleaning is on Thursday at 2 30 in the afternoon. Reply yes to confirm, or call us to move it.
> Your weekly summary is ready. You closed 14 tickets, and your average first reply time was 6 minutes. Nice work.
> Welcome to chapter three. In this chapter, we cover how to set up your account, and how to invite the rest of your team.

## Done when

- [ ] The request matches the one above, apart from the text and the job id.
- [ ] The webhook takes the PUT with the audio, and the page plays it a few seconds after the `request_id`.
- [ ] Unknown ids, repeat deliveries and oversized bodies are refused.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] A failed request, or audio that never comes, shows a sentence that says what to do next.

Docs: https://developers.deepgram.com/docs/tts-callback
