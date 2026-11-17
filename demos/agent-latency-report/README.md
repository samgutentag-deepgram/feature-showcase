# Latency report

**Where does the time go?** Talk to the agent and each turn breaks down into speech-to-text, the LLM's first token, text-to-speech, and the total, straight from the `LatencyReport` messages Deepgram sends. Each message carries one number; the panel puts a turn's numbers in one row. Give the agent a tool and ask about the weather to see a tool call's time.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-latency-report/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-latency-report

## What to try

- **A tool turn.** Leave the get_weather box ticked, press **Start talking**, and say "What is the weather in Paris right now?" The row shows STT, LLM first token, LLM first tool call, LLM first text (which includes the tool round trip), TTS, and the total.
- **A plain turn.** Untick the box and ask "What is the capital of France?" The tool column stays empty for that turn; the total drops.
- **Flux against Nova-3.** On Flux the header counts `stt_latency` reports arriving about every 250 ms for the whole call. On Nova-3 there is one per final transcript.

The timeline stays readable: `LatencyReport` is not listed there, only in the panel. `EndOfTurn` (Flux) and `FunctionCallRequest` are marked.

## What the API actually sends

Checked live on 2026-11-16. These differ from the [docs page](https://developers.deepgram.com/docs/voice-agent-latency-report):

- The docs show one message with every field. Live, **each `LatencyReport` carries exactly one field**. A plain turn sends four: `ttt_token_latency`, `ttt_text_latency`, `tts_latency`, `total_latency`, all within about 0.1 s of the reply's first audio. Group them yourself; this page closes a turn on `total_latency`.
- A tool turn sends `ttt_token_latency` and `ttt_tool_latency`, then, after your `FunctionCallResponse`, `ttt_token_latency` again and `ttt_text_latency`, which includes the tool round trip.
- The docs say the report comes "after each turn". `stt_latency` does not: on Flux it arrives about every 240 ms for the whole call, silence included, with values from 0 to 80 ms. On Nova-3 it arrives once per final user transcript.
- `ttt_thinking_latency` never arrived with gpt-4o-mini (not a thinking model), so the page shows that column only if it shows up.
- There is no switch: `flags.latency_report` is rejected with `UNPARSABLE_CLIENT_MESSAGE`. The reports always come, as the docs say.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ...}   (nothing extra: LatencyReport is always on)
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio, events, and {"type":"LatencyReport","<one field>":<seconds>} ═══
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `groupReports()` in `index.tsx` folds the single-field reports into turns: a turn opens on the
  user's final transcript, takes the latest `stt_latency` seen, and closes on `total_latency`.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-latency-report pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: agent, tool, the latency panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The panel's table and waterfall bars |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

From the top of `index.tsx`:

```text
Latency report: the per-stage timings the Voice Agent API sends on every turn, with no setting
to turn on. Checked live 2026-11-16 with synthetic user speech (Aura-2 audio streamed at real time),
gpt-4o-mini as the LLM and aura-2-thalia-en as the voice:
  Every LatencyReport carries exactly one field, not the whole breakdown the docs' example shows.
  A plain turn sends four, all within about 0.1 s of the reply's first audio: ttt_token_latency
  0.49, ttt_text_latency 0.49, tts_latency 0.07, total_latency 0.59 (seconds).
  A tool turn sends ttt_token 0.52 and ttt_tool 0.52, then after FunctionCallResponse ttt_token
  again and ttt_text 1.20 (the tool round trip is inside it), tts 0.07, total 1.30.
  stt_latency on Flux arrives about every 240 ms for the whole call, silence included, cycling
  0 to 0.08 in 0.02 steps. On Nova-3 it arrives once per final user transcript (0.07 to 0.09).
  ttt_thinking_latency never arrived (gpt-4o-mini does not think). flags.latency_report is
  UNPARSABLE_CLIENT_MESSAGE: there is no switch, the reports always come.
The panel groups the single-field reports into one row per turn and only shows fields that arrived.
Verified live 2026-11-16: ONLY=agent-latency-report pnpm verify:live passed. Both Settings
variants (with and without get_weather) came back SettingsApplied on Flux and Nova-3, the prompt's
phrase spoken to the agent came back as get_weather({"city":"Paris"}), and the docs link resolved.
LatencyReport fields and cadence above come from separate live probes the same day.
```
