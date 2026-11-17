# custom-topics

**Will Deepgram find your topics?** Type a few topics of your own, pick `custom_topic_mode=extended`
or `strict`, then speak or type a support request. The page lists each of your topics as returned
(with its score) or not returned, and shows every segment with your topics filled in and
Deepgram's own topics plain. Run once in each mode and the two runs stay side by side.

- **Live:** https://dg-devrel-demos.fly.dev/demos/custom-topics/
- **Kind:** LLM, Audio and Text Intelligence (Nova-3 on `/v1/listen`, `/v1/read` for text)
- **Docs:** https://developers.deepgram.com/docs/topic-detection

## What to try

- **Type tab, defaults.** The topics are `refund, shipping delay, password reset`. The text is about
  a late router, so the first two are in it and `password reset` is not. Send it in extended, then
  in strict. Extended returns Deepgram's own topics (for example "Router delivery", "Refund
  request") alongside yours. Strict returns only your topics, never `password reset`, and sometimes
  an empty `"segments": []`.
- **The password chip.** Swap in the password text: now `password reset` is the topic in the text.
- **Speak tab.** Press Start mic and read the suggested phrase. The recording is sent once to
  `/v1/listen` as a WAV.

## Notes from testing

- `custom_topic` needs `topics=true`. Without it `/v1/read` returns a 400: "Request did not enable
  any features".
- Matching is by meaning, not by word: `router` in strict mode came back empty on a text that says
  "router", while `shipping delay` came back.
- Strict is not repeatable: the same request returned one custom topic on some tries and empty
  segments on others. Extended was steady across repeats.
- Up to 100 `custom_topic` values per request (the docs' limit); the page sends at most 100.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=custom-topics pnpm dev
```

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
