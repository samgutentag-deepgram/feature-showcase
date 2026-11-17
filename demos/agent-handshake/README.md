# Agent handshake

**Watch the agent say hello.** Every Voice Agent session opens the same way: the socket opens, Deepgram sends `Welcome` with a `request_id`, the client sends `Settings`, and `SettingsApplied` comes back. The panel runs that opening on a socket of its own, with no mic and no agent audio, times each step, and then breaks the order on purpose so you see the real error code.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-handshake/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-welcome-message

## What to try

- **Handshake.** Press **Handshake** in the panel. You get open, `Welcome`, Settings sent, and `SettingsApplied` in milliseconds, plus the session's `request_id`.
- **Break it.** Press **Audio before Settings**, **Settings twice**, and **Malformed Settings**. Each shows the `Error` code Deepgram sent and the socket closing. **Audio before SettingsApplied** shows that audio sent right after `Settings` is fine.
- **Talk to it.** Press **Start talking** and say "Hi, can you hear me?" The panel shows your conversation's `Welcome`, `request_id`, and `SettingsApplied`. Pick **Malformed** first and the session ends at `Settings` with an `Error`.

What follows `SettingsApplied` when the agent has a greeting is in the [agent greeting demo](../agent-greeting/).

## What came back (2026-11-16)

| Scenario | What the page sends | What Deepgram sent |
|---|---|---|
| Handshake | Settings after Welcome | `SettingsApplied`, 30 to 110 ms after Settings |
| Audio before Settings | 100 ms of silent audio, then Settings | `Error` `NON_SETTINGS_MESSAGE_BEFORE_SETTINGS`, socket closed |
| Audio before SettingsApplied | Settings, then audio at once | `SettingsApplied`, no error |
| Settings twice | Settings again after SettingsApplied | `Error` `SETTINGS_ALREADY_APPLIED`, socket closed |
| Malformed Settings | `greeting` at the top level, not in `agent` | `Error` `UNPARSABLE_CLIENT_MESSAGE` ("Check the greeting field") |

`Welcome` arrived in the same millisecond the socket opened, every time. Sending `Settings` on open,
before `Welcome` arrives, also works; that is what **Start talking** does.

## Docs and the API disagree

The [errors page](https://developers.deepgram.com/docs/voice-agent-errors) says
`NON_SETTINGS_MESSAGE_BEFORE_SETTINGS` fires for any message sent before `Settings`. In live tests a
binary audio frame did trigger it, but a `KeepAlive` sent before `Settings` was accepted and the
session went on to `SettingsApplied`.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  ◀── {"type": "Welcome", "request_id": "..."}
  │  first message: {"type": "Settings", ...}
  │  ◀── {"type": "SettingsApplied"}
  │  ═══ 16 kHz PCM from the mic (Start talking only) ═══════▶
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The panel's runs are in [`handshake.ts`](handshake.ts): one fresh token and socket per press,
  closed once the answer is in. They listen with Flux; the handshake is the same on Nova-3.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-handshake pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: agent, copy, the Settings toggle, and the panel. The comment at the top records what was verified live |
| [`handshake.ts`](handshake.ts) | The five scenarios, each on its own socket, with every step timed |
| [`styles.css`](styles.css) | The panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
