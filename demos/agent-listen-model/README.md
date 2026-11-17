# Voice agent listen model

**Pick what your agent listens with.** Choose Flux, Flux multilingual, Nova-3, or Nova-2 as the
voice agent's speech-to-text model, say the same line on each with a pause in the middle, and
compare how the turns came out. Flux ends the turn itself and sends `EndOfTurn`; Nova transcribes
and the turn ends on a pause.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-listen-model/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-stt-models

## What to try

- **One line, two models.** Press **Start talking** on Flux, say "So I would like to order", stop
  for a second or two, then "two large pizzas for pickup." Stop, switch to Nova-3, and do it again.
  The two runs sit side by side.
- **Read the turn list.** Under the buttons, each thing you said gets a row: when the transcript
  came back, whether an `EndOfTurn` came with it, how long until the agent's voice started, and the
  `total_latency` the agent reported.
- **What we saw in testing.** With synthetic speech and a 1.5 s pause, Flux kept the sentence as one
  user line with `EndOfTurn {"trigger":"model"}`. Nova-3 split it into two user lines at the pause
  and sent no `EndOfTurn`. One run each, so treat the timings as a sample, not a benchmark.

## What changes in `agent.listen.provider`

| | Flux (`flux-general-en`, `flux-general-multi`) | Nova (`nova-3`, `nova-2`) |
|---|---|---|
| `version` | `v2`, required | `v1`, the default |
| End of turn | `eot_threshold`, `eager_eot_threshold`, `eot_timeout_ms` | none of these |
| Other fields | `language_hints` on `flux-general-multi` only | `smart_format`, `language` |
| Both | `keyterms` | `keyterms` |

The page sends `eot_threshold: 0.7` (Flux's default) so the knob shows on the Request card, and
`smart_format: true` on Nova. A field sent to the wrong family fails the whole `Settings` message.
Leave out `agent.language` with `flux-general-multi`: it is `INVALID_SETTINGS` there.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-listen-model pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: listen models, provider fields per family, the turn list panel, copy |
| [`styles.css`](styles.css) | The field table and the turn list |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
