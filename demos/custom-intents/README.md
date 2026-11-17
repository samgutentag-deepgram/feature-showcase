# custom-intents

**Does the caller want one of your intents?** Type the intents your app acts on (the defaults are "cancel subscription", "update payment method" and "speak to a manager"), pick `custom_intent_mode=strict` or `extended`, then read the suggested line on the mic or send the prefilled text. Strict returns only intents from your list. Extended adds the ones Deepgram names on its own, so the package question in the default text shows up as a second, unlisted intent. The last two runs sit side by side, and each tag says whether it came from your list.

- **Live:** https://dg-devrel-demos.fly.dev/demos/custom-intents/
- **Docs:** https://developers.deepgram.com/docs/intent-recognition

`intents=true` is required. `custom_intent` alone is a 400 ("Request did not enable any features").

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=custom-intents pnpm dev
```

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
