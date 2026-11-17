# Agent think fallback

**Break the first LLM. The agent still answers.** `agent.think` is a list here: OpenAI `gpt-4o-mini` first, Anthropic `claude-haiku-4-5` second. Tick **Break the first LLM** to give the first one `temperature: 5`, which OpenAI refuses, then press Start talking and ask a question. Three `THINK_REQUEST_FAILED` Warnings arrive, then Anthropic answers. The panel lists each Warning, says which provider answered, and keeps the first reply's latency from each setting so you can see what the detour costs.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-think-fallback/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-llm-models

## What to try

1. Leave **Break the first LLM** ticked, press Start talking, and ask "Which company trained you?" (or press **Ask who answered**). Expect three Warnings, then "Anthropic".
2. Stop, untick it, and ask again. Expect no Warnings and "OpenAI". The panel shows both first-reply latencies and the difference.
3. With it broken, ask a second question. No new Warnings: the session stays on the fallback.

## How the first provider is broken

The first provider gets `temperature: 5`. OpenAI accepts 0 to 2, so Settings applies and then every request comes back `400 Bad Request` ("Invalid 'temperature': decimal above maximum value. Expected a value <= 2"). No key, no endpoint, a current model, and every request stays with providers Deepgram already manages. It keeps working as long as OpenAI keeps its 0 to 2 range and Deepgram does not start checking it at Settings.

Tried and dropped:

- `endpoint.url: https://example.com/v1/chat/completions` (a domain reserved for examples). It failed at think time with `405`, but Deepgram's server would POST every visitor question and the prompt to a host we do not control.
- A `.invalid` host and a TEST-NET IP address: refused at Settings with `Error` `INVALID_SETTINGS` ("Failed to resolve endpoint", "Invalid endpoint").
- A made-up model on a managed provider (`claude-does-not-exist`, `gemini-does-not-exist`): `INVALID_SETTINGS` at Settings, before any turn.
- `gpt-4.1-nano`: fails at think time today (404 upstream), but would start answering if the model came back.

## What came back in testing

| Setting | Warnings on the first turn | Who answered | First reply `total_latency` |
|---|---|---|---|
| Both up | none | OpenAI `gpt-4o-mini` | 0.47 to 0.58 s |
| First LLM broken | three `THINK_REQUEST_FAILED`, `400 Bad Request`, within about 0.5 s | Anthropic `claude-haiku-4-5` | 0.88 to 0.98 s |

`claude-haiku-4-5` on its own answered in 0.42 to 0.45 s, so the detour cost about half a second, once: the three refused tries are real round trips to OpenAI. Later turns in a broken session had no Warnings and normal latency.

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

Verified live 2026-11-16: ONLY=agent-think-fallback pnpm verify:live passed. With Flux and Nova-3 listening, both Settings (first LLM at temperature 5, and both up) came back SettingsApplied with no Error, Ask who answered came back AgentAudioDone in both (with the first LLM broken, only the Anthropic fallback could have replied), and the prompt.md Settings worked with a granted token.

The probes behind the tables above are recorded at the top of [`index.tsx`](index.tsx).
