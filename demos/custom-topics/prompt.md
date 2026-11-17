<!-- Generated from the feature's index.tsx by shared/llm/prompt.ts. Do not edit by hand. -->
# Add Custom topics to a web app with Deepgram

Type the topics you care about, then speak or type a support request. Extended returns your topics plus the ones Deepgram finds on its own. Strict returns only yours, and only the ones it finds in the text.

Build a page that sends a recording or typed text to Deepgram once, with `custom_topic`, `custom_topic_mode`
set as below, and shows what comes back. Live demo: https://dg-devrel-demos.fly.dev/demos/custom-topics/

## The request

Every request here is sent to the live API before this file ships.

### Text: `/v1/read`

```http
POST https://api.deepgram.com/v1/read?language=en&topics=true&custom_topic=refund&custom_topic=shipping+delay&custom_topic=password+reset&custom_topic_mode=extended
Authorization: Bearer <token>
Content-Type: application/json

{"text":"Hi, I ordered a new router two weeks ago and it still has not arrived. The tracking page says the package is stuck in a warehouse in Ohio. If it does not show up by Friday, I want a full refund to my credit card."}
```

`language=en` is required on `/v1/read`; without it the request is a 400.

### Audio: `/v1/listen`

The same params work on pre-recorded audio. Record the mic (or take a file), then send it in one POST:

```http
POST https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en&topics=true&custom_topic=refund&custom_topic=shipping+delay&custom_topic=password+reset&custom_topic_mode=extended
Authorization: Bearer <token>
Content-Type: audio/wav

<your recording: 16 kHz mono 16-bit WAV>
```

Do not stream these: the `/v1/listen` WebSocket refuses `topics`, `intents` and `summarize` at the
handshake, and takes `sentiment` but sends no sentiment back.

## Keep the API key on your server

The browser never sees `DEEPGRAM_API_KEY`. Add one server route, `GET /api/token`, that asks
Deepgram for a short-lived token and returns it as plain text:

```http
POST https://api.deepgram.com/v1/auth/grant
Authorization: Token <DEEPGRAM_API_KEY>
Content-Type: application/json

{"ttl_seconds": 30}
```

The response is JSON with `access_token`. Refuse the route to other sites: answer 403 when
`Sec-Fetch-Site` is present and not `same-origin`. In the browser, fetch a fresh token for every
request and send it as `Authorization: Bearer <token>`. Deepgram allows these requests from a
browser (CORS), so no proxy is needed.

## Read the response

- `results.summary`: `text` on `/v1/read`, `short` on `/v1/listen`. Under about 50 words, the summary is the input itself.
- `results.topics.segments[]`, `results.intents.segments[]`: `text`, `start_word`, `end_word`, and `topics[]` or `intents[]` with `confidence_score`.
- `results.sentiments.segments[]` with `sentiment` and `sentiment_score` (-1 to 1), and `results.sentiments.average`.
- `/v1/listen` also returns the transcript in `results.channels[0].alternatives[0].transcript`.

## Try it

Say this, then send the recording:

> My new router still has not arrived after two weeks. If it is not here by Friday, I want a refund.

Or send this text:

> Hi, I ordered a new router two weeks ago and it still has not arrived. The tracking page says the package is stuck in a warehouse in Ohio. If it does not show up by Friday, I want a full refund to my credit card.

## Done when

- [ ] The page sends the request above, with `custom_topic`, `custom_topic_mode` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] The result shows the fields that matter, not the raw JSON alone.
- [ ] Errors show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/topic-detection
