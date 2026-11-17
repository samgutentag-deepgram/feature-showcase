# think-model-compare

**Which LLM should answer the phone?** Type what a caller says. The same `/v1/think` request goes to Think-Fast and phoneLLM mini at the same time, and each reply streams into its own column with time to first token, total time, and tokens in and out. Turn reasoning on to see what it costs each model.

- **Live:** https://dg-devrel-demos.fly.dev/demos/think-model-compare/
- **Kind:** LLM (`/v1/think`), Early Access
- **Docs:** https://developers.deepgram.com/docs/llm/models

## What to try

- **Same line, two models.** Press Send on the prefilled line. Both columns fill at once; compare the wording and the first token times.
- **Reasoning.** Pick **Reasoning low** and send again. Think-Fast reports `reasoning_tokens` and its first token arrives later. phoneLLM mini writes its reasoning into the reply, ending in `</think>`; the page shows that part apart from the reply.
- **Numbers.** Try the callback number chip. Think-Fast is tuned for speech and reads the number back digit by digit, in words, the way a voice would say it.

## How it works

```
browser                       server.js                Deepgram
  │  GET /api/token  ─────────▶  grant (30 s token) ───▶  /v1/auth/grant
  │  ◀──────────── token
  │  POST agent.deepgram.com/v1/think  {"model": "think-fast", ...}                  ─▶ stream
  │  POST agent.deepgram.com/v1/think  {"model": "phonellm-mini-alpha-2-fp8", ...}   ─▶ stream
```

- Two POSTs, sent together, with the same body except `model`. Each streams server-sent events
  (`stream: true` needs `stream_options: {"include_usage": true}`), so the page can time the first
  token and read token usage from the last chunk.
- Deepgram LLMs are Early Access: the key's project must be enrolled, and the API can change before
  general availability.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=think-model-compare pnpm dev
```

## Verified live

```text
Verified live 2026-11-16: verify:live streamed both models at reasoning none and low, all four
replies non-empty. By hand, "move my cleaning to Thursday afternoon" (none): Think-Fast first token
494 ms, 109 in / 34 out; phoneLLM mini 378 ms, 108 in / 18 out. At low: Think-Fast 2501 ms with 422
reasoning tokens; phoneLLM mini 430 ms, reasoning text then </think> in the reply. Callback number
chip: Think-Fast read it back as "four one five, five five five, zero one four two".
```
