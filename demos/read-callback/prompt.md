<!-- Generated from the feature's index.tsx by shared/llm/prompt.ts. Do not edit by hand. -->
# Add Text Intelligence Callback to a web app with Deepgram

Type or keep the support email. Deepgram answers the POST at once with a request_id, then delivers the summary to a webhook on this page's server, which checks the Basic Auth password it put in the callback URL.

Build a page that sends typed text to Deepgram once, with `callback`, `callback_method`
set as below, and shows what comes back. Live demo: https://dg-devrel-demos.fly.dev/demos/read-callback/

## The request

Every request here is sent to the live API before this file ships.

### Text: `/v1/read`

```http
POST https://api.deepgram.com/v1/read?language=en&summarize=v2&callback_method=put&callback=https%3A%2F%2Fexample.com%2Fdeepgram-callback
Authorization: Bearer <token>
Content-Type: application/json

{"text":"Hi team, following up on ticket 5521. Our nightly export to the analytics warehouse has failed three nights in a row since we upgraded to the new connector. The job starts on time, runs for about forty minutes, and then stops with a timeout while writing the largest table. Smaller tables finish fine. We already raised the timeout to two hours and doubled the worker memory, and neither helped. The finance team needs last week's numbers by Thursday morning for the board review, so this is urgent for us. Could someone look at the connector logs today, or tell us how to roll back to the previous version safely? I am online until six. Thanks, Priya."}
```

`language=en` is required on `/v1/read`; without it the request is a 400.

## Take the result on a webhook

With `callback` set, Deepgram answers the POST at once with `{"request_id": "..."}` and later
POSTs the result to the callback URL (`callback_method=put` makes it a PUT). Replace
`https://example.com/deepgram-callback` with a public URL on your server, on port 80, 443, 8080 or 8443. Answer the
delivery with a 2xx: Deepgram retries a failed one up to 10 times, 30 seconds apart. The browser
cannot take a webhook, so the page asks your server for the result by `request_id` until it lands.

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

## Try it

Send this text:

> Hi team, following up on ticket 5521. Our nightly export to the analytics warehouse has failed three nights in a row since we upgraded to the new connector. The job starts on time, runs for about forty minutes, and then stops with a timeout while writing the largest table. Smaller tables finish fine. We already raised the timeout to two hours and doubled the worker memory, and neither helped. The finance team needs last week's numbers by Thursday morning for the board review, so this is urgent for us. Could someone look at the connector logs today, or tell us how to roll back to the previous version safely? I am online until six. Thanks, Priya.

## Done when

- [ ] The page sends the request above, with `callback`, `callback_method` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] The result shows the fields that matter, not the raw JSON alone.
- [ ] Errors show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/text-intelligence-callback
