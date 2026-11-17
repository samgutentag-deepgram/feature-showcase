# think-tools

**Let the model call your functions.** The visitor asks about store hours or an order. The
`/v1/think` request declares two tools, `get_store_hours` and `check_order_status`, with JSON
Schema parameters. The model answers with a tool call, the page answers it with fake data as a
`tool` message, and the model replies from that result. The page shows every round: what was sent,
the tool call and its arguments, the result sent back, and the final reply. One suggestion needs no
tool, so the model replies straight away. Deepgram LLMs are Early Access.

- **Live:** https://dg-devrel-demos.fly.dev/demos/think-tools/
- **Docs:** https://developers.deepgram.com/docs/llm/request-response-format

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=think-tools pnpm dev
```

## Verified live

Verified live 2026-11-16: verify:live passed on think-fast and phonellm-mini-alpha-2-fp8; both call get_store_hours({"city":"Austin","day":"Saturday"}) with finish_reason tool_calls, then reply from the tool result (Think-Fast spells times out: "nine in the morning to eight at night"). On the two-tool question Think-Fast returns both calls in one response; phoneLLM mini asks one per request (3 requests). "Hi, what can you help me with?" calls no tool on either.
