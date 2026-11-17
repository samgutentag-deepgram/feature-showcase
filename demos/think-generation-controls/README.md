# think-generation-controls

**Same question twice. Same answer?** Pick Think-Fast or phoneLLM mini and a temperature, then ask. The page sends the identical `/v1/think` request twice at once and shows both replies, with a note saying whether they match. Runs stay side by side, so temperature 0 sits next to temperature 1.

Early Access: the key's project must be enrolled in the Deepgram LLM program.

- **Live:** https://dg-devrel-demos.fly.dev/demos/think-generation-controls/

## What /v1/think takes

`temperature` (0 to 2) and `reasoning_effort` are the only generation controls. `max_tokens`, `max_completion_tokens`, `top_p`, `stop`, `seed`, `n` and `frequency_penalty` each return 400 `Invalid think request: unknown field` on both models, as the docs say. `reasoning_effort` is shown in `think-model-compare`.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=think-generation-controls pnpm dev
```

## Verified live

Verified live 2026-11-16: ONLY=think-generation-controls pnpm verify:live passed, 8 streamed /v1/think requests (2 models x temperature 0 and 1, each sent twice) all 200 with a reply, and every prompt.md request worked with a granted token. In the page, Think-Fast at 0 gave "The Caffeinated Circuit" on both tries; at 1 it gave "The Circuit Brew" and "The Silicon Sip".
