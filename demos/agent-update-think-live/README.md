# Update Think Live mid-call

**Hush the small talk mid-call.** Think Live fills silence with check-ins and drops in a "mhmm" while you talk. Stay quiet and the agent keeps asking if you are there. Press **Asides off** and the silence stays silent, press **Asides on** and it checks in again, all on the same connection.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-update-think-live/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-acknowledgements (message shape on the [Think Live page](https://developers.deepgram.com/docs/voice-agent-think-live#mid-session-updates))

This is the mid-call half of Think Live. [`think-live`](../think-live/) sets it once in the Settings
message; this demo changes it while the call is running.

## What to try

- **Turn it off.** Press **Start talking** and say nothing. A `presence_check` aside ("Are you still on the line?") comes about every 7 seconds. Press **Asides off**: `ThinkLiveUpdated` comes back, and the next 15 seconds of silence stay silent.
- **Turn it back on.** Press **Asides on**. After a long silence a check-in comes within a second or two.
- **Backchannels.** With asides on and Flux listening, read the suggested line slowly. A short "sure" or "mhmm" may land while you talk, tagged `backchannel`.
- **Start quiet.** Untick "Start with asides on" and do it the other way round.

The panel under the buttons cuts the call at each `ThinkLiveUpdated` and lists the Think Live lines in
each stretch, so the change shows as a count, not only as a feeling.

## The message

```json
{
  "type": "UpdateThink_Live",
  "think_live": {
    "provider": {
      "type": "deepgram",
      "version": "v1",
      "agent_backchannel_sensitivity": 0,
      "presence_check_max_count": 0,
      "presence_check_interval_ms": 4000
    }
  }
}
```

The server answers `{"type": "ThinkLiveUpdated"}`. The update replaces the whole
`think_live.provider` block, so send every field you want, not only the one you change.

## Docs and the API disagree

The coming-soon card for this demo names the message `UpdateThinkLive` and the ack
`ThinkLiveUpdated`. The ack is right, but `UpdateThinkLive` comes back
`Error UNPARSABLE_CLIENT_MESSAGE` and the session closes. The type that works is `UpdateThink_Live`,
with an underscore, which is what the
[acknowledgements page](https://developers.deepgram.com/docs/voice-agent-acknowledgements) and the
[Think Live page](https://developers.deepgram.com/docs/voice-agent-think-live#mid-session-updates)
use.

Not in the docs: in our tests `UpdateThink_Live` also turned Think Live on in a session whose
Settings had no `think_live` block at all (`ThinkLiveUpdated`, then a presence check 5.5 s later).

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think_live": {...}, ...}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  {"type": "UpdateThink_Live", "think_live": {...}} ─────▶
  │  ◀═══ ThinkLiveUpdated, agent audio and events ════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the Settings message and both `UpdateThink_Live` messages exactly as sent.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-update-think-live pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: agent, the two updates, copy, and the panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
