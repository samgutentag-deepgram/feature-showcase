# think-streaming

**Read the first word before the reply is done.** The visitor types a message (or picks one) and
the page sends it to `POST https://agent.deepgram.com/v1/think` twice at the same moment: once with
`"stream": false`, once with `"stream": true` and `"stream_options": {"include_usage": true}`. The
unstreamed lane shows nothing until the whole reply lands. The streamed lane fills in as server-sent
events arrive, and a shared timeline shows time to first token against time to the whole reply, one
tick per time the text grew, and the usage block that arrives in the last chunk before `data: [DONE]`.
Think-Fast or phoneLLM mini. Text only. Deepgram LLMs are Early Access.

- **Live:** https://dg-devrel-demos.fly.dev/demos/think-streaming/
- **Try:** keep the default 120-word prompt and press Send: the streamed lane starts in a few hundred
  ms while the other waits for the whole reply. Then pick "Say hello in five words." and the gap
  nearly disappears.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=think-streaming pnpm dev
```

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
