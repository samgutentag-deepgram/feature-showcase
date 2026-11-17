<!-- Generated from the feature's index.tsx by shared/llm/prompt.ts. Do not edit by hand. -->
# Add Think streaming to a web app with Deepgram

Your message goes to /v1/think twice at the same moment, once with stream false and once with stream true. The streamed one shows text as soon as the first token is ready; the other shows nothing until the whole reply is done. Early Access.

Build a page that sends a message to a Deepgram LLM, with `stream`, `stream_options` set as below, and shows the
reply. Live demo: https://dg-devrel-demos.fly.dev/demos/think-streaming/

Deepgram LLMs are in Early Access: the project must be enrolled, and fields can change before GA.

## The request

Every request here is sent to the live API before this file ships. The endpoint takes these
top-level fields only: `model`, `messages`, `temperature`, `reasoning_effort`, `tools`, `stream`,
`stream_options`, `mip_opt_out`. Anything else (`max_tokens`, `top_p`, `tool_choice`) is a 400.

**Model `think-fast`**

```http
POST https://agent.deepgram.com/v1/think
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "think-fast",
  "messages": [
    {
      "role": "user",
      "content": "Explain in about 120 words why a voice agent should stream its LLM reply into text-to-speech."
    }
  ],
  "temperature": 0,
  "stream": false
}
```

**And the same request on `think-fast`**

```http
POST https://agent.deepgram.com/v1/think
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "think-fast",
  "messages": [
    {
      "role": "user",
      "content": "Explain in about 120 words why a voice agent should stream its LLM reply into text-to-speech."
    }
  ],
  "temperature": 0,
  "stream": true,
  "stream_options": {
    "include_usage": true
  }
}
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

The response is JSON with `access_token`. Refuse the route to other sites: answer 403 when
`Sec-Fetch-Site` is present and not `same-origin`. In the browser, fetch a fresh token for every
request and send it as `Authorization: Bearer <token>`. Deepgram allows these requests from a
browser (CORS), so no proxy is needed.

## Read the stream

With `"stream": true` the response is `text/event-stream`. Each `data:` line is a
`chat.completion.chunk`: append `choices[0].delta.content`, and build tool calls from
`choices[0].delta.tool_calls` by `index` (`function.arguments` arrives in pieces). Then come a chunk
with `finish_reason`, a chunk with an empty `choices` and the `usage`, and `data: [DONE]`. A
stream that ends without `[DONE]` broke off: treat it as failed. Time to first token is from
sending the request to the first chunk with content.

## Try it

Send:

> Explain in about 120 words why a voice agent should stream its LLM reply into text-to-speech.

## Done when

- [ ] The page sends the request above, with `stream`, `stream_options` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Errors show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/llm/request-response-format
