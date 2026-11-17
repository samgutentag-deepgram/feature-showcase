<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Agent audio formats to a web app with Deepgram

Pick the audio format, press Start, and talk. The Settings audio block tells the agent what your mic sends and what it should send back. Browser audio is 16-bit PCM; phone audio is 8-bit mu-law or A-law at 8 kHz, a sixth of the reply bytes, and it sounds narrower because 8 kHz audio carries nothing above 4 kHz.

Build a page with a Start button that opens a voice conversation with a Deepgram voice agent
configured by the Settings message below. Live demo: https://dg-devrel-demos.fly.dev/demos/agent-audio-io/

## The connection

Open `wss://agent.deepgram.com/v1/agent/converse` and send this Settings message first, as a text frame. It is sent to the live
API before this file ships and comes back `SettingsApplied`.

```json
{
  "type": "Settings",
  "audio": {
    "input": {
      "encoding": "mulaw",
      "sample_rate": 8000
    },
    "output": {
      "encoding": "mulaw",
      "sample_rate": 8000,
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
      "prompt": "You are a friendly phone assistant. Answer in one or two short sentences. If asked to repeat a phrase, say it back exactly."
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "version": "v2",
        "model": "flux-wes-en"
      }
    },
    "greeting": "Hi, you're on the line. Ask me anything.",
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
and an AudioWorklet that downsamples to 8 kHz mono and converts to 8-bit mu-law. Send each
chunk (about 100 ms) as a binary WebSocket frame. Raw audio has no header, which is why
`audio.input` names `encoding` `mulaw` and `sample_rate` 8000.

Start sending mic audio only after `SettingsApplied` arrives.

## Play the agent

Binary frames from the agent are 8 kHz mono 8-bit mu-law with no container. Queue them
on an AudioContext so they play back to back. When `UserStartedSpeaking` arrives, stop and drop everything still queued, so the user can interrupt.

## Try it

Say:

> What is the capital of France?
> Repeat after me: she sells seashells by the seashore. (The s sounds show the difference most.)

## Done when

- [ ] The first message on the socket matches the Settings message above, apart from your own prompt and greeting.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/voice-agent-media-inputs-outputs
