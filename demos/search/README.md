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

Verified live 2026-11-16: pnpm verify:live opened /v1/listen?model=nova-3&search=Kallistrum&search=Trellisync on the socket and it was accepted; a streamed macOS clip of the suggested phrase came back with channel.search on each final, Kallistrum at confidence 0.965 (snippet "colistrum", 1.22 to 2.04 s) and Trellisync at 1.0 (3.62 to 4.45 s). Flux /v2/listen refused search with a 400.
