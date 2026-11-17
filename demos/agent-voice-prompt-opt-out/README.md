# agent-voice-prompt-opt-out

**Send your prompt as written.** Think-Fast, Deepgram's own LLM (Early Access), is tuned for voice, so in
the Voice Agent Deepgram puts spoken-style instructions ahead of your prompt and sends a `Warning` with
code `VOICE_PROMPT_ADDED`. This page's prompt asks for digits. Start a call, press "Send the test line"
with the opt-out off, then run it again with the opt-out on. The two runs land side by side: the first
has the warning and usually reads the order out as "A one two three four" and the time as "nine"; the
second has no warning and keeps "A1234" and, most times, "9 AM".

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-voice-prompt-opt-out/
- **Setting:** `agent.think.provider.voice_prompt_opt_out` (Boolean, default `false`, Think-Fast only)
- **Docs:** https://developers.deepgram.com/docs/llm/voice-agent#voice-style-instructions

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-voice-prompt-opt-out pnpm dev
```

## What we saw

Probed 2026-11-16 with the test line typed in (`InjectUserMessage`), four runs each way (the last with the page's exact Settings):

| | `voice_prompt_opt_out: false` | `voice_prompt_opt_out: true` |
|---|---|---|
| `VOICE_PROMPT_ADDED` warning | every run, before `SettingsApplied` | never |
| Order number | "A one two three four", 3 of 4 | "A1234", 4 of 4 |
| Pickup time | "nine", 4 of 4 | "9 AM", 3 of 4 |
| Phone number | spelled out, 4 of 4 | spelled out 2 of 4, digits 1, mixed 1 |
| Separate short line first ("Thanks!") | 3 of 4 | 2 of 4 |

Think-Fast leans spoken on its own, so the added instructions push the style rather than switch it. With
a vaguer prompt they also brought filler lines ("Let me look up that order.") and once a raw
`<tool_call>` text line with no functions defined.

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
