<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add UpdatePrompt to a web app with Deepgram

The agent starts as Juniper, a plain, friendly guide. Ask it something, press a style, and ask again: UpdatePrompt changes how it answers on the next turn, without reconnecting. The Settings prompt stays. Each new UpdatePrompt replaces the last one.

Build a page with a Start button that opens a voice conversation with a Deepgram voice agent
configured by the Settings message below. Live demo: https://dg-devrel-demos.fly.dev/demos/agent-update-prompt/

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
      "prompt": "You are Juniper, a friendly guide on a Deepgram demo page. If someone asks your name, say Juniper. Answer in one or two short sentences."
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "version": "v2",
        "model": "flux-wes-en"
      }
    },
    "greeting": "Hi, I am Juniper. Ask me anything, then change how I talk.",
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

## Mid-call messages

Once `SettingsApplied` has arrived, these go on the same socket as text frames, one per button.
Each is sent live before this file ships and comes back with the message named under it.

**Talk like a pirate**

```json
{
  "type": "UpdatePrompt",
  "prompt": "From now on, talk like a pirate in every answer."
}
```

Comes back: `PromptUpdated`.

**Answer in Spanish**

```json
{
  "type": "UpdatePrompt",
  "prompt": "From now on, answer only in Spanish."
}
```

Comes back: `PromptUpdated`.

**Be terse**

```json
{
  "type": "UpdatePrompt",
  "prompt": "From now on, answer in five words or fewer."
}
```

Comes back: `PromptUpdated`.

## Try it

Say:

> What is your name, and what is a good weekend hobby?
> (Press a style below, then ask the same question again.)

## Done when

- [ ] The first message on the socket matches the Settings message above, apart from your own prompt and greeting.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/voice-agent-update-prompt
