# topics

**What was this call about?** Read a short call aloud (or type text) that moves from a double
charge on a bill to a router that keeps dropping to a move date. The page sends it once with
`topics=true`, recorded audio to `/v1/listen` (Nova-3) or text to `/v1/read`, and shows each
segment Deepgram found with the topics it tagged and a confidence from 0 to 1. Topics are named
from the text itself, not picked from a fixed list. Supplying your own topics (`custom_topic`,
`custom_topic_mode`) is a separate demo, `custom-topics`.

- **Live:** https://dg-devrel-demos.fly.dev/demos/topics/
- **Docs:** https://developers.deepgram.com/docs/topic-detection

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=topics pnpm dev
```

## Verified live

Verified live 2026-11-16: ONLY=topics pnpm verify:live passed; topics=true on /v1/read (the call text) and /v1/listen (Nova-3, the call spoken by Aura-2) both returned results.topics. By hand on /v1/read: "Bill refund" 0.87, then "Internet router connection issue" 0.38 and "Moving to new apartment" 0.51 in one segment; the standup chip came back as one segment with Marketing budget 0.98, Paid ads 0.94, Hiring 0.77, Mobile app launch 0.93. Flux: /v2/listen?topics=true is a 400 at the handshake.
