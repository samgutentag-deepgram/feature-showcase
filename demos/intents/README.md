# intents

**What does this caller want?** Read a short call aloud (or type text) with three asks: cancel a
subscription, update the card on file, and get a refund for a double charge. The page sends it
once with `intents=true`, recorded audio to `/v1/listen` (Nova-3) or text to `/v1/read`, and shows
each segment Deepgram returned with the intents it found and a confidence from 0 to 1. Intents are
named from the text itself, phrased as verbs, not picked from a fixed list. In testing, all three
asks in the short call came back on one segment, each with its own confidence. Supplying your own
intents (`custom_intent`, `custom_intent_mode`) is a separate demo, `custom-intents`.

Flux does not take `intents` (`/v2/listen` answers 400 at the handshake), and neither does the
Nova-3 streaming socket (403), so the mic is recorded and sent once.

- **Live:** https://dg-devrel-demos.fly.dev/demos/intents/
- **Docs:** https://developers.deepgram.com/docs/intent-recognition

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=intents pnpm dev
```

## Verified live

Verified live 2026-11-16: ONLY=intents pnpm verify:live passed; intents=true on /v1/read (the call text) and /v1/listen (Nova-3, the call spoken by Aura-2) both returned results.intents. By hand on /v1/read, the call came back as one segment with Cancel subscription 0.89, Update credit card 0.97, Request refund 0.77; on /v1/listen (a macOS say clip of the same call) Cancel subscription 0.89, Update credit card 0.97, and "Request refund for extra charge" at 0.01. The flight chip: Book flight 0.47, Add checked bag 0.92, Receive hotel voucher 0.01. Flux: /v2/listen?intents=true is a 400 at the handshake; the Nova-3 socket is a 403.
