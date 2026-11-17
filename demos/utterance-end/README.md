# Utterance end

**How long a gap ends the utterance?** Read the phrase with a long pause in the middle. Nova-3 sends `speech_final` the moment you go quiet. With `utterance_end_ms` set, it also sends `UtteranceEnd`, but only once the gap after your last word is at least that long. Try 1000 ms, then 2500 ms, and compare where each one lands.

- **Live:** https://dg-devrel-demos.fly.dev/demos/utterance-end/
- **Kind:** Speech-to-text (Nova-3 only)
- **Docs:** https://developers.deepgram.com/docs/utterance-end

## What to try

- **The suggested phrase.** Pick 1000 ms, press **Start mic**, and read it with a slow count of two in the middle. Then pick 2500 ms and read it again. The two runs sit side by side.
- **The markers.** The transcript marks where each `speech_final` arrived (endpointing, default 10 ms of silence) and where each `UtteranceEnd` arrived, with its `last_word_end`. The timeline under each run gives the time of every message.
- **What we saw in testing.** With a 1.5 s pause, `speech_final` came after "a table for" at every setting. At 1000 ms an `UtteranceEnd` came there too, about a second later. At 1500 and 2500 ms the only `UtteranceEnd` came after the whole sentence.

Flux does not take `utterance_end_ms` (a 400 on `/v2/listen`). It ends turns on its own with `EndOfTurn`; the [turn detection demo](../turn-detection/) shows that.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&interim_results=true&utterance_end_ms=1000
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results, UtteranceEnd ═════════════════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- `interim_results=true` is on the card because it is required: without it the handshake is a
  400, "Utterance End feature requires interim results."
- `UtteranceEnd` is `{"type":"UtteranceEnd","channel":[0,1],"last_word_end":4.43}`. The Response
  card shows the last one.
- Deepgram checks for the gap as interim results arrive, roughly once a second, so `UtteranceEnd`
  lands between `utterance_end_ms` and about a second more after `last_word_end`.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=utterance-end pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: model, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |
| [`utterance-end.test.ts`](utterance-end.test.ts) | Unit tests for this demo, run by `pnpm test` |

## Verified live

From the top of `index.tsx`:

```text
utterance_end_ms on Nova-3: an UtteranceEnd message once there is a gap in the words at least
that long, next to the speech_final that endpointing sends the moment you go quiet.
Checked live 2026-11-16, streamed in real time: "I want to book a table for" [1.5 s silence]
"four people tomorrow night." (macOS voice Samantha), times from the socket opening:
  1000 ms  speech_final 1.79 s, UtteranceEnd 2.80 s (last_word_end 1.52), speech_final 4.74 s,
           UtteranceEnd 5.76 s (last_word_end 4.43)
  1500 ms  speech_final 1.77 s and 4.71 s, one UtteranceEnd 6.75 s (last_word_end 4.43)
  2500 ms  speech_final 1.77 s and 4.72 s, one UtteranceEnd 7.77 s (last_word_end 4.43)
Without interim_results=true the handshake is a 400 ("Utterance End feature requires interim
results."), so the card shows it. /v2/listen (Flux) answers utterance_end_ms with a 400
("Unknown query parameters: utterance_end_ms").
Verified live 2026-11-16: ONLY=utterance-end pnpm verify:live passed (3 tests): the socket
opened for utterance_end_ms 1000, 1500, and 2500 with interim_results=true, and the prompt.md
URL was accepted. The streamed timings above came from the same day.
```
