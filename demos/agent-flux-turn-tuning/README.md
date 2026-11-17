# Voice agent Flux turn tuning

**Should your agent wait, or jump in?** Pick Patient or Snappy end-of-turn settings for a voice
agent listening with Flux, say a line with a pause in the middle, and see whether the agent waits
for the rest or replies to the first half. The panel lists each `EndOfTurn`, what triggered it, and
how long after your last word the agent's voice started.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-flux-turn-tuning/
- **Kind:** Voice agent, Flux listen model only
- **Docs:** https://developers.deepgram.com/docs/flux/agent

## What to try

- **Same line, both settings.** On **Patient**, press **Start talking**, wait for the greeting, then
  say "So I would like to order", stop for about two seconds, and finish with "two large pizzas for
  pickup." Stop, switch to **Snappy**, and do it again. The two runs sit side by side.
- **Read the panel.** Each `EndOfTurn` gets a row: the line Flux heard, its `trigger` (`model` when
  Flux was confident, `timeout` when `eot_timeout_ms` ran out), and the wait from your last word to
  the agent's voice. "It cut in" means you were still talking when the reply started.
- **What we saw in testing.** With a macOS `say` clip and a 2.1 s pause, Patient kept the sentence
  as one turn (`trigger: model`) and replied 2.8 s after "pickup". Snappy cut in during the pause:
  "So I would like to order." ended on `trigger: timeout` and the agent started 1.6 s after "order".
  One run each, so treat the timings as a sample, not a benchmark.

## The settings

| | `eot_threshold` | `eot_timeout_ms` |
|---|---|---|
| Patient | `0.9` | `8000` |
| Snappy | `0.5` | `1000` |
| Flux default | `0.7` | `5000` |

`eot_threshold` (0.5 to 1.0) is how confident Flux must be that you are done. `eot_timeout_ms` (500
to 60000) ends the turn after that much silence, however unsure Flux is. Both go on
`agent.listen.provider` with `model: "flux-general-en"` and `version: "v2"`. They are Flux only:
`eot_threshold` on a Nova listen model fails the `Settings` message with `UNPARSABLE_CLIENT_MESSAGE`. `eager_eot_threshold`, which starts the reply early, has its own demo.

The wait from your last word is timed on this page from the mic level, since `EndOfTurn` carries no
word times. Agent audio through your speakers is ignored. Headphones give the cleanest numbers.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-flux-turn-tuning pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: the two presets, the listen fields, the EndOfTurn panel, copy |
| [`styles.css`](styles.css) | The preset picker and the turn list |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

Verified live 2026-11-16: ONLY=agent-flux-turn-tuning pnpm verify:live passed. Both Settings variants (Patient eot_threshold 0.9 + eot_timeout_ms 8000, Snappy 0.5 + 1000) came back SettingsApplied on flux-general-en, the prompt.md Settings applied with a granted token, and the docs link resolved. The cut-in timings above come from separate live probes the same day.
