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

Verified live 2026-11-16: pnpm verify:live sent both modes on /v1/read and /v1/listen (Aura-2 audio), all 200 with intents. By curl, the default text and list: strict returned only "update payment method" (0.74, 0.21); extended returned it plus Deepgram's own package intent ("Request information about package location" and similar, three of three). "speak to a manager", absent from the text, never came back. Unlike custom topics, strict was not empty for a text with none of the listed intents: it named "update payment method" at 0.20.
