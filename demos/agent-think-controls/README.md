# Think controls

**Same question, new settings.** Turn the knobs on the agent's LLM. Temperature 0 names the same ice cream flavor every call; 1.5 makes up a new one. Reasoning effort on gpt-5-mini trades a longer wait for more thinking. Ask, stop, change one setting, ask again.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-think-controls/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/configure-voice-agent

## What to try

- **Temperature.** Pick `temperature, gpt-4o-mini` and `0`. Press **Start talking**, then ask for a flavor name (say it or press the button in the panel). Stop and do it again: the same name comes back. Switch to `1.5` and ask twice more: a new name each call.
- **Reasoning effort.** Pick `reasoning_mode, gpt-5-mini` and `minimal`, ask the bat and ball question, then repeat at `high`. The panel's LLM first-token time grows from well under a second to several seconds.
- Every reply stays in the panel table with its run, setting and first-token time, so the runs sit side by side.

## What the API accepts

Only two generation controls go on `agent.think.provider`, and each one works only on the models that take it:

| Field | Accepted | Rejected |
|---|---|---|
| `temperature` | open_ai gpt-4o-mini (0 to 2), anthropic claude-haiku-4-5 (0 to 1), groq, google | gpt-5-mini: the provider answers 400, three `THINK_REQUEST_FAILED` warnings, then `FAILED_TO_THINK` |
| `reasoning_mode` | open_ai gpt-5-mini: `minimal`, `low`, `medium`, `high` | gpt-4o-mini, same warnings then `FAILED_TO_THINK`; any other value is `UNPARSABLE_CLIENT_MESSAGE` |

`max_tokens`, `max_completion_tokens`, `top_p`, `frequency_penalty`, `presence_penalty`, `seed` and `stop` all fail the Settings message with `UNPARSABLE_CLIENT_MESSAGE`, so the page does not offer them.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think": {"provider": {"temperature": 0, ...}}}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio (24 kHz PCM), events, LatencyReport ═══
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The panel's button sends the question as `InjectUserMessage`. The first-token time is the
  `ttt_token_latency` field of the `LatencyReport` that arrives with each reply.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-think-controls pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: settings, controls, the replies panel, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The pickers and the replies table |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

From the top of `index.tsx`:

```text
Think controls: the generation settings on agent.think.provider, temperature and reasoning_mode.
Probed live 2026-11-16 on the Agent API, one fresh session per ask, the question sent with
InjectUserMessage after the greeting:
  open_ai gpt-4o-mini, "Name a new ice cream flavor": temperature 0 said "Lavender Honey Bliss."
  three sessions out of three. Temperature 1.5 said "Coastal Caramel Swirl.", "Tropical Sunrise
  Sorbet." and "Coconut Lime Swirl.". LLM first token about 0.6 s either way.
  open_ai gpt-5-mini, the bat and ball question: reasoning_mode minimal first token 0.63 to 0.84 s,
  low 1.2 to 1.4 s, medium 1.9 to 2.0 s, high 3.1 to 3.8 s. Every level answered five cents
  in these runs (minimal once said ten cents in an earlier probe with a different prompt).
  Rejected: temperature on gpt-5-mini (OpenAI 400 "Only the default (1) value is supported", three
  THINK_REQUEST_FAILED warnings, then Error FAILED_TO_THINK). reasoning_mode on gpt-4o-mini (OpenAI
  400 "Unrecognized request argument supplied: reasoning_effort", same pattern). temperature 3 on
  gpt-4o-mini and 1.5 on anthropic claude-haiku-4-5 (provider range errors, same pattern).
  max_tokens, max_completion_tokens, top_p, frequency_penalty, presence_penalty, seed and stop on
  open_ai, and max_tokens on anthropic: Error UNPARSABLE_CLIENT_MESSAGE at Settings. A reasoning_mode
  outside minimal, low, medium, high: UNPARSABLE_CLIENT_MESSAGE.
  Also accepted: temperature on anthropic claude-haiku-4-5, groq openai/gpt-oss-20b and google
  gemini-2.5-flash; reasoning_mode low on groq openai/gpt-oss-20b.
Docs mismatch: reasoning_mode also takes "minimal" (the docs list low, medium, high).
Verified live 2026-11-16: ONLY=agent-think-controls pnpm verify:live passed. All seven Settings
variants (gpt-4o-mini at temperature 0, 1, 1.5; gpt-5-mini at reasoning_mode minimal, low, medium,
high) came back SettingsApplied on Flux and Nova-3, the InjectUserMessage button came back
ConversationText on each, and the docs link resolved. Replies and first-token times above come from
separate probes the same day (temperature 1 gave "Lavender Honey Bliss." then "Mango Chili Tango.").
```
