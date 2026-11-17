# Sentiment analysis

**Did the call end better than it started?** Read a customer message that starts annoyed and ends
pleased, or send it as text. Deepgram splits it where the mood shifts, tags each part negative,
neutral, or positive with a score from -1 to +1, and averages the whole message.

- **Live:** https://dg-devrel-demos.fly.dev/demos/sentiment/
- **Kind:** LLM, Audio and Text Intelligence (Nova-3 audio on `/v1/listen`, text on `/v1/read`)
- **Docs:** https://developers.deepgram.com/docs/sentiment-analysis

## What to try

- **Speak.** Press **Start mic**, read the suggested message, then **Stop**. The recording goes to
  `/v1/listen` once. The first segment comes back red (negative), the middle grey (neutral), the
  last green (positive), and the average sits on a meter from -1 to +1.
- **Type.** The same message is prefilled; send it to `/v1/read`. The second chip, about a checkout
  crash, ends grateful but averages negative, because the complaint is the longer part.
- **The break point.** A score between -0.33 and +0.33 is neutral. In testing the spoken middle
  segment scored -0.25 and still came back neutral.

Sentiment is batch only here. The `/v1/listen` socket opens with `sentiment=true` but no streamed
message carries a sentiment, and Flux (`/v2/listen`) refuses the param with a 400.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=sentiment pnpm dev
```

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
