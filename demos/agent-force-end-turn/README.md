# Agent force end turn

**Let go to end your turn.** Hold the button while you talk to a voice agent, and let go when you are done. The page sends `ForceEndTurn` on the agent socket and the agent answers right away. Flux listens with `eot_threshold` 1.0, so it never ends a turn on its own and a pause mid-sentence does not cut you off.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-force-end-turn/
- **Kind:** Voice agent, Flux listen only
- **Docs:** https://developers.deepgram.com/docs/voice-agent-force-end-turn

## What to try

- **Pause, then let go.** Press **Start talking**, wait for the greeting, then hold **Hold while you talk** and say "So for the trip I was thinking we could maybe... um..." Pause as long as you like, finish with "...go somewhere warm", and let go. The panel shows the turn as **Ended by you**, how long after the release `EndOfTurn` arrived, and when the reply audio started.
- **Let Flux decide too.** Stop, pick **You or Flux (eot_threshold 0.7)**, and do the same with a long pause. Flux ends the turn on its own (**Ended by Flux**) before you let go.
- **Let go twice.** A release with no turn in progress ends nothing. The agent sends nothing back, not even a Warning, and the panel says so.

Headphones help: without them the agent can hear itself through your speakers.

## The message

```json
{ "type": "ForceEndTurn" }
```

Sent as a text frame on `wss://agent.deepgram.com/v1/agent/converse` after `SettingsApplied`. The
listen provider must be Flux (`"model": "flux-general-en", "version": "v2"`). In live tests the
agent answered within 100 ms with the user's `ConversationText` and
`{"type": "EndOfTurn", "trigger": "manual"}` together, and the first reply audio came 0.72 s after
the press.

## Why Flux only

With Nova-3 listen, every `ForceEndTurn` got a Warning, `FORCE_END_TURN_UNSUPPORTED`: "ForceEndTurn
requires a Deepgram v2 (Flux) listen provider. The current turn was not ended." So the listen toggle
offers Flux alone.

## Docs and the API disagree

The [docs page](https://developers.deepgram.com/docs/voice-agent-force-end-turn) says the user's
`ConversationText` is followed by `AgentThinking`. In live tests on 2026-11-16 `AgentThinking` never
arrived; `EndOfTurn` with `"trigger": "manual"` did, though the agent docs do not mention it. A
second `ForceEndTurn` with no turn in progress was ignored with no Warning, as the docs say. (The
Flux speech-to-text socket answers the same case with `FORCE_END_TURN_NO_ACTIVE_TURN`.)

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "listen": {"provider": {"eot_threshold": 1, ...}}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  on release: {"type": "ForceEndTurn"} ─────────────────▶
  │  ◀═══ EndOfTurn (trigger manual), then agent audio ═══════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The mic stays open the whole call. The button does not mute it; it only says when the turn ends.
- `eot_timeout_ms` 30000 is a backstop: if you never let go, Flux ends the turn after 30 s.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-force-end-turn pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: agent, listen settings, the hold button, and the turn panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The hold button and the turn list |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
