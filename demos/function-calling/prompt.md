<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Function calling to a web app with Deepgram

Ask the agent about an order. With the function on, it calls get_order_status in this page, gets an answer back, and says it out loud. Turn the function off and ask again: it has nothing to look it up with.

Build a page with a Start button that opens a voice conversation with a Deepgram voice agent
configured by the Settings message below. Live demo: https://dg-devrel-function-calling.fly.dev

## The connection

Open `wss://agent.deepgram.com/v1/agent/converse` and send this Settings message first, as a text frame. It is sent to the live
API before this file ships and comes back `SettingsApplied`.

```json
{
  "type": "Settings",
  "audio": {
    "input": {
      "encoding": "linear16",
      "sample_rate": 16000
    },
    "output": {
      "encoding": "linear16",
      "sample_rate": 24000,
      "container": "none"
    }
  },
  "agent": {
    "language": "en",
    "think": {
      "provider": {
        "type": "open_ai",
        "model": "gpt-4o-mini"
      },
      "prompt": "You are a friendly support agent for Acme. Keep answers to one or two short sentences.",
      "functions": [
        {
          "name": "get_order_status",
          "description": "Look up where an order is. Call this whenever the caller asks about an order.",
          "parameters": {
            "type": "object",
            "properties": {
              "order_id": {
                "type": "string",
                "description": "The order number, digits only"
              }
            },
            "required": [
              "order_id"
            ]
          }
        }
      ]
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "model": "aura-2-thalia-en"
      }
    },
    "greeting": "Hi, thanks for calling Acme support. How can I help?",
    "listen": {
      "provider": {
        "type": "deepgram",
        "model": "flux-general-en"
      }
    }
  }
}
```

`listen` uses Flux (`flux-general-en`), built for turn-taking. `nova-3` also works as the listen model.

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

In the browser, fetch a fresh token for every session and open the socket with it as a
subprotocol: `new WebSocket(url, ['bearer', token])`.

## Capture the mic

Use `getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })`
and an AudioWorklet that downsamples to 16 kHz mono and converts to 16-bit signed
little-endian PCM. Send each chunk (about 100 ms) as a binary WebSocket frame. Raw PCM has no
header, which is why the request names `encoding=linear16` and `sample_rate=16000`.

Start sending mic audio only after `SettingsApplied` arrives.

## Play the agent

Binary frames from the agent are 24 kHz mono 16-bit PCM with no container. Queue them
on an AudioContext so they play back to back. When `UserStartedSpeaking` arrives, stop and drop everything still queued, so the user can interrupt.

## Answer function calls

When the agent decides to call a function it sends `FunctionCallRequest` with a `functions`
array. For each entry with `"client_side": true`, parse `arguments` (a JSON string), run your
code, and reply on the same socket:

```json
{
  "type": "FunctionCallResponse",
  "id": "<the id from the request>",
  "name": "get_order_status",
  "content": "{\"order_id\":\"4815\",\"status\":\"out for delivery\",\"eta\":\"today by 6 pm\",\"note\":\"demo data\"}"
}
```

`content` is a string: JSON-encode your result. For the phrase below, the request names
`get_order_status` with arguments `{"order_id":"4815"}`.

## Try it

Say:

> Hi, can you tell me where my order is? The order number is 4815.

## Done when

- [ ] The first message on the socket matches the Settings message above, apart from your own prompt and greeting.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Saying the phrase makes the agent call `get_order_status`, the page answers, and the agent speaks the result.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/voice-agents-function-calling
