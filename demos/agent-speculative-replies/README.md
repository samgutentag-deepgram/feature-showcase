# Voice agent speculative replies

**Does the agent think before you finish?** With a Flux listen model, the voice agent sends your
words to the LLM while your turn is still open, holds the reply, and plays it once the turn is
confirmed. `eager_eot_threshold` sets how early that starts. Say a line with a hesitation, switch
the setting, say it again, and compare when the reply starts after your last word.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-speculative-replies/
- **Kind:** Voice agent, Flux listen model only
- **Docs:** https://developers.deepgram.com/docs/voice-agent-speculative-replies

## What to try

- **Same line, two settings.** On **0.3**, press **Start talking**, wait for the greeting, and
  say "I would like a table for ... um ... four people, tomorrow night." with a short pause at each
  set of dots. Stop, pick **0.8**, and say it again. The panel keeps the previous run next to the
  new one.
- **Read each turn.** Every `EndOfTurn` gets a row: how long after your last word the agent's voice
  started, how long after `EndOfTurn`, how many times the LLM answered before `EndOfTurn`, and how
  many times `UserStartedSpeaking` arrived in that one turn.

## What the socket shows

The agent socket does not forward Flux's `EagerEndOfTurn` or `TurnResumed`, and no message says a
speculative reply was thrown away. What you can see:

- A `LatencyReport` with `ttt_token_latency` that arrives before `EndOfTurn`: the LLM already
  answered while the turn was open.
- `UserStartedSpeaking` more than once in one turn. The docs say a resumed turn sends it, and the
  speculative reply is dropped.
- Agent audio within about 0.15 s of `EndOfTurn`: the reply was ready before the turn was confirmed.

## What we measured

Live probes on 2026-11-16 with `flux-general-en`, `gpt-4o-mini` and `flux-wes-en`, streaming macOS
`say` clips at real time. Reply start is the agent's first audio after the end of the last word, in ms.

| `eager_eot_threshold` | "What is the capital of France?" | Line with two pauses |
|---|---|---|
| Not set | 1077, 1028, 1017 | 1283, 1299, 1323 |
| 0.3 | 1066, 974 | 1279, 1288, 1543 |
| 0.5 | 1382, 1323 | 1358, 1349 |
| 0.7 | | 1808, 1773 |
| 0.8 | 1421, 1618 | 1906 |

On the line with pauses, leaving it unset gave three LLM answers before `EndOfTurn` and four
`UserStartedSpeaking` in one turn. At 0.7 and 0.8 there were none and one, and the LLM started only
after `EndOfTurn`. So in these runs the agent already replies speculatively with the field left out,
about like 0.3, and raising it narrows the window and makes replies later. A few runs each, with
synthetic speech, so treat the numbers as a sample, not a benchmark.

## Limits

- Range 0.3 to 0.9. 0.2 and 0.95 fail the `Settings` message with `INVALID_SETTINGS`.
- No higher than `eot_threshold`. With `eot_threshold` left out, 0.8 is accepted and 0.9 fails with
  "eager_eot_threshold cannot be greater than eot_threshold".
- Flux only. On `nova-3` the field fails with `UNPARSABLE_CLIENT_MESSAGE`.

The wait from your last word is timed on this page from the mic level, since the agent sends no word
times. Agent audio through your speakers is ignored. Headphones give the cleanest numbers.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-speculative-replies pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the threshold picker, the listen fields, the per-turn panel, copy |
| [`styles.css`](styles.css) | The picker and the turn lists |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

Verified live 2026-11-16: ONLY=agent-speculative-replies pnpm verify:live passed. All four Settings variants (eager_eot_threshold 0.3, not set, 0.5, 0.8, on flux-general-en v2) came back SettingsApplied, the prompt.md Settings applied with a granted token, and the docs link resolved. The reply-start timings above come from separate live probes the same day.
