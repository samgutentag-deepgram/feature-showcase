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

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
