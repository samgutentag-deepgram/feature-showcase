<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Agent History events to a web app with Deepgram

With flags.history on, the agent sends a History message for every line said and every function it called, the moment it happens. The page builds its log from History messages alone. Turn the flag off and have the same conversation: the agent talks just the same, and the log stays empty.

Build a page with a Start button that opens a voice conversation with a Deepgram voice agent
configured by the Settings message below. Live demo: https://dg-devrel-demos.fly.dev/demos/agent-history-events/

## The connection

Open `wss://agent.deepgram.com/v1/agent/converse` and send this Settings message first, as a text frame. It is sent to the live
API before this file ships and comes back `SettingsApplied`.

```json
{
  "type": "Settings",
  "flags": {
    "history": true
  },
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
      "prompt": "You are a friendly assistant for Acme stores in Portland and Seattle. Use get_store_hours for any question about opening or closing times. Keep answers to one short sentence.",
      "functions": [
        {
          "name": "get_store_hours",
          "description": "Today's opening hours for one Acme store. Call this whenever the caller asks when a store opens or closes.",
          "parameters": {
            "type": "object",
            "properties": {
              "store": {
                "type": "string",
                "enum": [
                  "Portland",
                  "Seattle"
                ],
                "description": "The store city"
              }
            },
            "required": [
              "store"
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
    "greeting": "Hi, this is Acme. How can I help?",
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
  "name": "get_store_hours",
  "content": "{\"store\":\"Portland\",\"opens\":\"9 am\",\"closes\":\"9 pm\",\"note\":\"demo data\"}"
}
```

`content` is a string: JSON-encode your result. For the phrase below, the request names
`get_store_hours` with arguments `{"store":"Portland"}`.

## Try it

Say:

> What time does the Portland store close today?

## Done when

- [ ] The first message on the socket matches the Settings message above, apart from your own prompt and greeting.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Saying the phrase makes the agent call `get_store_hours`, the page answers, and the agent speaks the result.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/voice-agent-history
