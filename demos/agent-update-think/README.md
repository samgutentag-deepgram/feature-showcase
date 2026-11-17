# UpdateThink

**Swap its brain mid-call.** The agent starts on OpenAI gpt-4o-mini. Ask it something, switch to Anthropic, Google, Groq or Deepgram Think-Fast, and ask again. Same call, same voice, a different LLM answering, with its first-token time next to each reply.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-update-think/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-update-think

## What to try

- **Ask, swap, ask again.** Press **Start talking**, say "What is a good name for a pet octopus?", then press **Deepgram think-fast** under "Switch the LLM to". When `ThinkUpdated` lands, ask the same question. The panel files each reply under the LLM that wrote it, with `ttt_token_latency` (first token) and `total_latency` from the `LatencyReport` messages.
- **Compare speed.** In testing, think-fast's first token came back in about 0.16 s, gpt-4o-mini and claude-haiku-4-5 in about 0.6 s, gemini-2.5-flash in about 1.5 s.
- **Swap the prompt.** **gpt-4o-mini as a pirate** keeps the model and replaces the prompt in the same message.

This is not `UpdatePrompt` (which adds to the prompt) and not an LLM picked before the call starts: the provider, model and prompt change while the call stays up.

## What the API does

Checked live on 2026-11-16:

- `UpdateThink` replaces the whole `think` block. After a pirate prompt, an `UpdateThink` with only a `provider` gave plain English replies again. So each button here sends the prompt too.
- `deepgram` `think-fast` (Early Access) answers `Warning` `VOICE_PROMPT_ADDED` just before `ThinkUpdated`: Deepgram puts its voice-style instructions ahead of your prompt. The panel shows the warning on that row.
- `groq` `openai/gpt-oss-20b` worked with no `endpoint`, though the [LLM models page](https://developers.deepgram.com/docs/voice-agent-llm-models) says Groq requires one.
- A model the API does not know (`anthropic` `claude-3-5-haiku-latest`) comes back `Error` `INVALID_SETTINGS` "model not available" and the session closes. Offer a known list.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think": {"provider": {"type": "open_ai", ...}}}}
  │  mid-call:      {"type": "UpdateThink", "think": {"provider": {...}, "prompt": "..."}}
  │  ◀── {"type": "ThinkUpdated"}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio (24 kHz PCM) and events ════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the Settings message and every `UpdateThink` exactly as sent. The timeline
  marks `ThinkUpdated`.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-update-think pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the starting LLM, the swaps, the panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The switch panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

```text
Verified live 2026-11-16: ONLY=agent-update-think pnpm verify:live passed. The Settings message (open_ai gpt-4o-mini, flux-wes-en) came back SettingsApplied on Flux and Nova-3, each of the five UpdateThink messages came back ThinkUpdated on both, and the docs link resolved.
```
