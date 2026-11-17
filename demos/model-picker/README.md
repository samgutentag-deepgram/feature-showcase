# model-picker

**Siobhan, or Chevron?** Read one line with a surname, a first name, and some jargon. Run it on
Flux, then on a Nova model, and compare the two transcripts side by side.

- **Live:** https://dg-devrel-demos.fly.dev/demos/model-picker/
- **Kind:** Speech-to-text (Flux, Nova-3, Nova-2, Nova, Enhanced, Base)
- **Docs:** https://developers.deepgram.com/docs/model

## What to try

- **The suggested line.** Press **Start mic** on Flux and read it. Flip to **Nova**, pick
  `nova` or `base`, and read it again. The two runs sit side by side.
- **Newest against oldest.** Run `nova-3`, then `base`. Watch the names and "Kubernetes".
- **The wire.** The Request card shows `model=` with the picked model. On Nova runs the Response
  card shows `model_info.name` and `version` from the result, so you can see which model answered.

Flux runs on `/v2/listen` and writes capitals and punctuation on its own. The Nova models run on
`/v1/listen` with no other params, so they write lowercase words with no punctuation. Domain
options (`nova-3-medical`, `nova-2-phonecall`, and the rest) use the same `model` param; see the
docs. Mic only; no upload.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=model-picker pnpm dev
```

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
