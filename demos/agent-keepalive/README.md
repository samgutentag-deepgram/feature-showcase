# Agent keepalive

**Put the caller on hold.** Talk to the agent, then press Mute. The page stops sending audio and sends KeepAlive every 8 seconds instead, so the call stays open. Unmute after 20 seconds and pick up where you left off. Turn the repeat off and the call drops 12 seconds into the silence.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-keepalive/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/agent-keep-alive

## What to try

- **Hold and come back.** Press **Start talking**, say the first suggested line, press **Mute**, wait 20 seconds, press **Unmute**, and say the last line. The timeline shows `KeepAlive (sent)` every 8 s while muted, and the agent answers your order number on the same call.
- **Without the repeat.** Untick the box and do it again. Mute sends one `KeepAlive` and then nothing. About 12 s later Deepgram sends `Error` `CLIENT_MESSAGE_TIMEOUT` and closes the call. The panel shows the error and how long you were muted.

The agent listens with Nova-3 only. In testing Nova-3 closed a call 12 s after the last thing the
client sent; Flux waited 60 s, as long as this page's one-minute call, so the drop could not show
here. KeepAlive every 8 s held both.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"listen": {"provider": {"model": "nova-3"}}, ...}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  Mute: mic audio stops, {"type": "KeepAlive"} now and every 8 s
  │  Unmute: mic audio resumes on the same socket
  │  ◀═══ agent audio (24 kHz PCM) and events ════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message exactly as sent, then the KeepAlive that Mute
  and Unmute send. The server sends nothing back for a KeepAlive.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-keepalive pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the agent, the Mute and Unmute actions, the hold panel, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The hold panel's meter and log |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
