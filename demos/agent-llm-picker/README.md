# Agent LLM picker

**Pick the brain behind your voice agent.** Choose the LLM a Deepgram voice agent thinks with, from Deepgram's own models (Early Access) or the managed OpenAI, Anthropic, Google, Groq and NVIDIA models, press Start, and talk. Ask the same question on a few models and the panel puts their reply latency side by side, straight from the `LatencyReport` messages the agent sends.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-llm-picker/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-llm-models

## What to try

- **Deepgram first.** Leave it on Think-Fast, press **Start talking**, and press **Ask the same question** (or say "In one sentence, why is the sky blue?"). The Request card shows `"type": "deepgram", "model": "think-fast"` under `think.provider`, and the timeline shows the `VOICE_PROMPT_ADDED` warning.
- **Compare.** Stop, press **Anthropic** (or any other provider), pick a model, start again, and ask the same question. Each run adds a row to "Reply latency by model": LLM first token and total, per turn.

## Which models

Every model below replied on 2026-11-16 with no endpoint and no third-party key.

| Provider (`type`) | Models |
|---|---|
| `deepgram` (Early Access) | `think-fast`, `phonellm-mini-alpha-2-fp8` |
| `open_ai` | `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1`, `gpt-5-nano`, `gpt-5-mini`, `gpt-5`, `gpt-5.1`, `gpt-5.2`, `gpt-5.4-nano`, `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5`, `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-6-luna` |
| `anthropic` | `claude-haiku-4-5`, `claude-haiku-5-5`, `claude-sonnet-4-5`, `claude-sonnet-4-6`, `claude-sonnet-5`, `claude-sonnet-5-5` |
| `google` | `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3.8-flash` |
| `groq` | `openai/gpt-oss-20b` |
| `nvidia` | `nvidia/nemotron-3.5-lightning-30b-a3b` |

**Left out.** `gpt-4.1-nano` was applied but every turn failed (`THINK_REQUEST_FAILED`, upstream 404, then `FAILED_TO_THINK`). These models from the docs page came back `INVALID_SETTINGS` ("model not available"): `gpt-5.3-chat-latest`, `gpt-5.2-chat-latest`, `gpt-5.1-chat-latest`, `claude-3-5-haiku-latest`, `claude-sonnet-4-20250514`, `gemini-3.1-flash-lite-preview`, `gemini-3-pro-preview`, `gemini-2.0-flash-lite`, `nemotron-3-nano-30B-A3B`. Amazon Bedrock (`aws_bedrock`) needs your own AWS credentials and endpoint, so a public page cannot offer it.

**Docs differences.** Groq replied with no `endpoint`, though the docs say it is required. `GET https://agent.deepgram.com/v1/agent/settings/think/models` lists several models the docs page does not (all of which replied) and none of the `deepgram` models.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think": {"provider": {"type", "model"}}, ...}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio, ConversationText, LatencyReport ═══════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The LLM is fixed for the call. Changing it mid-call is a different message, `UpdateThink`.
- The latency board keeps one row per run for this page view. Each `LatencyReport` carries one field;
  a turn closes on `total_latency`. One run is a small sample, so treat the numbers as a rough guide.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-llm-picker pnpm dev
```

Then open <http://localhost:8080>.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: Settings, controls, latency board, copy. The comment at the top records what was verified live |
| [`models.ts`](models.ts) | The providers and models offered, Deepgram first |
| [`styles.css`](styles.css) | The model picker and the latency board |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
