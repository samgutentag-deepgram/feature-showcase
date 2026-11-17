# Agent think fallback

**Break the first LLM. The agent still answers.** `agent.think` is a list here: OpenAI `gpt-4o-mini` first, Anthropic `claude-haiku-4-5` second. Tick **Break the first LLM** to point the first one at `https://example.com/v1/chat/completions`, then press Start talking and ask a question. Three `THINK_REQUEST_FAILED` Warnings arrive, then Anthropic answers. The panel lists each Warning, says which provider answered, and keeps the first reply's latency from each setting so you can see what the detour costs.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-think-fallback/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-llm-models

## What to try

1. Leave **Break the first LLM** ticked, press Start talking, and ask "Which company trained you?" (or press **Ask who answered**). Expect three Warnings, then "Anthropic".
2. Stop, untick it, and ask again. Expect no Warnings and "OpenAI". The panel shows both first-reply latencies and the difference.
3. With it broken, ask a second question. No new Warnings: the session stays on the fallback.

## How the first provider is broken

`example.com` is reserved for examples (RFC 2606). It resolves and answers every request, but there is no LLM behind it, so each try comes back `405 Method Not Allowed`. No key, no endpoint of our own, and nothing that changes if a model is retired. Two other ideas did not work: a `.invalid` host and a TEST-NET IP address were both refused at Settings with `Error` `INVALID_SETTINGS` ("Failed to resolve endpoint", "Invalid endpoint"), so the server checks the URL before the call starts.

## What came back in testing

| Setting | Warnings on the first turn | Who answered | First reply `total_latency` |
|---|---|---|---|
| Both up | none | OpenAI `gpt-4o-mini` | 0.47 to 0.58 s |
| First LLM broken | three `THINK_REQUEST_FAILED`, `405 Method Not Allowed`, within about 0.2 s | Anthropic `claude-haiku-4-5` | 0.68 to 0.81 s |

`claude-haiku-4-5` on its own answered in 0.42 to 0.45 s, so the detour itself cost about 0.25 to 0.4 s, once. Later turns in a broken session had no Warnings and normal latency.

**Docs differences.**

- The docs say "each new conversational turn starts again from the first provider". In testing, once a session fell back, later turns went straight to the fallback with no Warnings.
- The docs describe a `THINK_REQUEST_FAILED` Warning per failed request; each failed provider sent three.
- On the turn that fell back, the fallback was given the first provider's prompt. With a prompt per provider that names it, that turn began "OpenAI here." although Anthropic answered; later turns began "Anthropic here.". The page uses one prompt for both.

Deepgram does not say which provider answered, so the panel infers it from the Warnings. Asking the model who trained it is the check.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think": [first, second]}}
  │  ◀═══ Warning THINK_REQUEST_FAILED x3, then the second provider's reply ═══
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message exactly as sent. The panel reads every server
  message of the run.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-think-fallback pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the provider chain, the panel, copy. The comment at the top records what was probed live |
| [`styles.css`](styles.css) | The chain list and panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
