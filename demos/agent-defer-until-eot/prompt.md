<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Agent defer until end of turn to a web app with Deepgram

On Flux, the voice agent starts on its reply before you finish talking, and a function call it makes in that window goes out at once. Say "Cancel order A1234", a short beat, then "Um, no wait, I meant order B5678." Without defer_until_eot, the page gets a cancel_order call for A1234 while you are still talking, and runs it. With it, the call waits for the end of your turn and only B5678 is cancelled.

Build a page with a Start button that opens a voice conversation with a Deepgram voice agent
configured by the Settings message below. Live demo: https://dg-devrel-demos.fly.dev/demos/agent-defer-until-eot/

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
    "think": {
      "provider": {
        "type": "open_ai",
        "model": "gpt-4o-mini"
      },
      "prompt": "You are an order support agent for Acme. If the caller corrects an order number, use only the corrected one. Keep answers to one short sentence.",
      "functions": [
        {
          "name": "cancel_order",
          "description": "Cancel an order. Call this as soon as the caller asks to cancel an order and names its number.",
          "parameters": {
            "type": "object",
            "properties": {
              "order_id": {
                "type": "string",
                "description": "The order number in capitals with no spaces, like B5678"
              }
            },
            "required": [
              "order_id"
            ]
          },
          "defer_until_eot": true
        }
      ]
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "model": "flux-wes-en"
      }
    },
    "greeting": "Acme orders, how can I help?",
    "listen": {
      "provider": {
        "type": "deepgram",
        "model": "flux-general-en",
        "version": "v2"
      }
    }
  }
}
```

`listen` uses Flux (`flux-general-en`).

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
  "name": "cancel_order",
  "content": "{\"order_id\":\"B5678\",\"status\":\"cancelled\",\"note\":\"demo data\"}"
}
```

`content` is a string: JSON-encode your result. For the phrase below, the request names
`cancel_order` with arguments `{"order_id":"B5678"}`.

## Try it

Say:

> Cancel order A1234. Um, no wait, I meant order B5678.

## Done when

- [ ] The first message on the socket matches the Settings message above, apart from your own prompt and greeting.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Saying the phrase makes the agent call `cancel_order`, the page answers, and the agent speaks the result.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/voice-agent-function-call-cancelled
