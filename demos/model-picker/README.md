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

From the top of `index.tsx`:

```text
Verified live 2026-11-16: pnpm verify:live opened /v2/listen?model=flux-general-en and /v1/listen?model= nova-3, nova-2, nova, enhanced, base on the socket, all accepted; prompt.md URLs and docs link passed.
```

The same read of "Doctor Okonkwo moved the Kubernetes rollout to March third. Send forty two
dollars to Siobhan." (macOS voice), streaming: Flux "Aconquo ... Kubernetes ... Siobhan"; nova-3
and nova-2 "okonkwo ... kubernetes ... siobhan"; nova "akanko ... cuba needs ... chevron";
enhanced "o'conquo ... kubernetes ... siobhan"; base "a ... cuban needs ... siobhan".
