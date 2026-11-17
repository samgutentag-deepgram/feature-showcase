# search

**Did they say Kallistrum? Search can tell.** Type the words you are listening for (comma separated) and read the suggested phrase into the mic. Nova-3 streams the transcript, and every final result carries a `search` block: for each term, the places Deepgram heard it, with `confidence`, `start`, `end`, and the `snippet` of transcript it lined up with. The Response card lists the best hits per term, and the transcript marks every snippet found at confidence 0.5 or higher. The match is acoustic, so a made-up name the transcript misspells ("colistrum") is still found for `search=Kallistrum`.

Nova-3 only: Flux answers `search` with a 400 on `/v2/listen`.

- **Live:** https://dg-devrel-demos.fly.dev/demos/search/

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=search pnpm dev
```

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
