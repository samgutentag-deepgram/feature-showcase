<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add Agent keepalive to a web app with Deepgram

Talk to the agent, then press Mute. The page stops sending audio and sends KeepAlive every 8 seconds instead, so the call stays open. Unmute after 20 seconds and pick up where you left off. Turn the repeat off and the call drops 12 seconds into the silence.

Build a page with a Start button that opens a voice conversation with a Deepgram voice agent
configured by the Settings message below. Live demo: https://dg-devrel-demos.fly.dev/demos/agent-keepalive/

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
      "prompt": "You are a support agent for Acme. The caller may put you on hold; when they come back, pick up where you left off. Keep answers to one short sentence."
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "version": "v2",
        "model": "flux-wes-en"
      }
    },
    "greeting": "Hi, thanks for calling Acme. How can I help?",
    "listen": {
      "provider": {
        "type": "deepgram",
        "model": "nova-3"
      }
    }
  }
}
```

`listen` uses Nova-3 (`nova-3`).

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

## Mid-call messages

Once `SettingsApplied` has arrived, these go on the same socket as text frames, one per button.
Each is sent live before this file ships and comes back with the message named under it.

**Mute**, then stop sending mic audio, and send it again every 8 s while the mic is off

```json
{
  "type": "KeepAlive"
}
```

Nothing comes back; the session just carries on.

**Unmute**, then start sending mic audio again

```json
{
  "type": "KeepAlive"
}
```

Nothing comes back; the session just carries on.

## Try it

Say:

> Hi, can you hold on a second while I grab my order number?
> (Press Mute, wait 20 seconds, then Unmute:)
> Okay, I'm back. The order number is four five six.

## Done when

- [ ] The first message on the socket matches the Settings message above, apart from your own prompt and greeting.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/agent-keep-alive
