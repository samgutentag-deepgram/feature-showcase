<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add UpdateSpeak to a web app with Deepgram

The agent starts as Alexis, a Flux voice. Press another voice and it answers in that voice straight away, Flux or Aura-2, without reconnecting.

Build a page with a Start button that opens a voice conversation with a Deepgram voice agent
configured by the Settings message below. Live demo: https://dg-devrel-update-speak.fly.dev

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
      "prompt": "You are a cheerful guide. Answer in one or two short sentences."
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "version": "v2",
        "model": "flux-alexis-en"
      }
    },
    "greeting": "Hi, I am your guide. Ask me anything, and switch my voice whenever you like.",
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

**Kit (Flux)**

```json
{
  "type": "UpdateSpeak",
  "speak": {
    "provider": {
      "type": "deepgram",
      "version": "v2",
      "model": "flux-kit-en"
    }
  }
}
```

Comes back: `SpeakUpdated`.

Once it does, send this too (and drop the queued agent audio):

```json
{
  "type": "InjectAgentMessage",
  "behavior": "interrupt",
  "message": "This is Kit, a Flux voice. Ask me for another fact."
}
```

**Cole (Flux)**

```json
{
  "type": "UpdateSpeak",
  "speak": {
    "provider": {
      "type": "deepgram",
      "version": "v2",
      "model": "flux-cole-en"
    }
  }
}
```

Comes back: `SpeakUpdated`.

Once it does, send this too (and drop the queued agent audio):

```json
{
  "type": "InjectAgentMessage",
  "behavior": "interrupt",
  "message": "This is Cole, a Flux voice. Ask me for another fact."
}
```

**Haley (Flux)**

```json
{
  "type": "UpdateSpeak",
  "speak": {
    "provider": {
      "type": "deepgram",
      "version": "v2",
      "model": "flux-haley-en"
    }
  }
}
```

Comes back: `SpeakUpdated`.

Once it does, send this too (and drop the queued agent audio):

```json
{
  "type": "InjectAgentMessage",
  "behavior": "interrupt",
  "message": "This is Haley, a Flux voice. Ask me for another fact."
}
```

**Thalia (Aura-2)**

```json
{
  "type": "UpdateSpeak",
  "speak": {
    "provider": {
      "type": "deepgram",
      "model": "aura-2-thalia-en"
    }
  }
}
```

Comes back: `SpeakUpdated`.

Once it does, send this too (and drop the queued agent audio):

```json
{
  "type": "InjectAgentMessage",
  "behavior": "interrupt",
  "message": "This is Thalia, a Aura-2 voice. Ask me for another fact."
}
```

**Orion (Aura-2)**

```json
{
  "type": "UpdateSpeak",
  "speak": {
    "provider": {
      "type": "deepgram",
      "model": "aura-2-orion-en"
    }
  }
}
```

Comes back: `SpeakUpdated`.

Once it does, send this too (and drop the queued agent audio):

```json
{
  "type": "InjectAgentMessage",
  "behavior": "interrupt",
  "message": "This is Orion, a Aura-2 voice. Ask me for another fact."
}
```

## Try it

Say:

> Tell me a fun fact about octopuses.
> (Press a voice. It introduces itself, then:) Tell me another one.

## Done when

- [ ] The first message on the socket matches the Settings message above, apart from your own prompt and greeting.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Mic errors and socket closes show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/voice-agent-update-speak
