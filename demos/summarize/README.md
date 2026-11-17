# summarize

**What did that voicemail say?** Read a support voicemail aloud, or paste one in, and Deepgram returns a few sentences that say who called, what went wrong, and what they want. The summary sits beside what you sent, with a word count on each.

- **Live:** https://dg-devrel-demos.fly.dev/demos/summarize/
- **Kind:** LLM, Audio and Text Intelligence (Nova-3 for audio)
- **Docs:** https://developers.deepgram.com/docs/summarization

## What to try

- **Speak.** Press **Start mic**, read the suggested voicemail (about 30 seconds), then **Stop and send**. The page records it and sends it once to `/v1/listen?model=nova-3&smart_format=true&language=en&summarize=v2`.
- **Type.** The same voicemail is prefilled. Press **Send** to post it to `/v1/read?language=en&summarize=v2`.
- **Short input.** On the Type tab, pick the short chip (16 words). Summaries need more than 50 words, so Deepgram returns the text unchanged, and the page says so.

## Notes

- `/v1/read` puts the summary in `results.summary.text`; `/v1/listen` puts it in `results.summary.short`. The shared `analysis()` reads both.
- `summarize` is refused on the streaming `/v1/listen` socket, so the mic is recorded and sent as one WAV.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=summarize pnpm dev
```

## Verified live

```text
Verified live 2026-11-16: ONLY=summarize pnpm verify:live passed (the 101-word voicemail on /v1/read, and spoken by Aura-2 on /v1/listen). curl: /v1/read returned summary.text and /v1/listen summary.short, three sentences naming Dana Whitfield, the grinding left leg motor, and the Monday deadline; a 16-word text came back unchanged.
```
