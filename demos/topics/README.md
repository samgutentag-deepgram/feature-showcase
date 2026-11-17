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

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
