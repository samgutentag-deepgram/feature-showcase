# KeepAlive

**Go quiet for 12 seconds. Is Deepgram still listening?** Start the mic and read the first line,
pause the audio with or without `KeepAlive`, wait about 12 seconds, then resume and read the
second line.

- **Live:** https://dg-devrel-demos.fly.dev/demos/stt-keepalive/
- **Kind:** Speech-to-text (Nova-3 only)
- **Docs:** https://developers.deepgram.com/docs/audio-keep-alive

## What to try

- **With KeepAlive.** Press **Start mic**, read "The meeting starts at nine.", press
  **Go quiet with KeepAlive**, wait about 12 seconds, press **Resume audio**, and read the second
  line. The timeline shows a `KeepAlive` going out every 3 seconds, and the second line is
  transcribed on the same socket (same `request_id`).
- **Without it.** Run it again with **Go quiet without KeepAlive**. About 12 seconds after the last
  audio, Deepgram sends `Metadata` and closes the socket. The page shows the close code and reason
  it received: `1011`, "Deepgram did not receive audio data or a text message within the timeout
  window. See https://dpgr.am/net0001".
- **The wire.** The Request card shows the plain Nova-3 socket and the one message the page sends
  mid-stream, `{"type":"KeepAlive"}`. It gets no reply.

Pausing stops sending mic audio; the mic itself keeps running. File upload is off in this demo;
reading the phrase shows the effect.

### Why Nova-3 only

Flux does not support `KeepAlive` yet. `/v2/listen` answers it with an `Error`
(`UNPARSABLE_CLIENT_MESSAGE`, "unknown variant `KeepAlive`, expected one of `CloseStream`,
`ForceEndTurn`, `Configure`") and closes the socket. Flux also did not time out the same way: a
Flux socket with no audio stayed open for 40 seconds, sent nothing meanwhile, and picked the turn
back up when audio returned.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  (audio paused)  {"type":"KeepAlive"} every 3 s ────────▶  no reply, socket stays open
  │  ═══ audio again ═══════════════════════════════════════▶
  │  ◀═══ Results, same request_id ══════════════════════════
```

- Without the `KeepAlive` frames, Deepgram closes the socket with `1011` and `NET-0001`.
- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=stt-keepalive pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, actions, timeline, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
TODO
```
