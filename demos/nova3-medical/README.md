# Nova-3 Medical

**Does your model know lisinopril?** Read a short medication list out loud. Run it on plain
`nova-3`, then on `nova-3-medical`, and compare how each writes down the drug names and doses.

- **Live:** https://dg-devrel-demos.fly.dev/demos/nova3-medical/
- **Kind:** Speech-to-text (Nova-3 only; Flux has no medical model)
- **Docs:** https://developers.deepgram.com/docs/model

## What to try

- **The suggested phrase.** Press **Start mic** with `nova-3` picked and read it. Then pick
  `nova-3-medical` and read it again. The two runs sit side by side.
- **Your own.** Read the names on a prescription bottle, or the drugs you know get misheard.
- **The wire.** The Request card shows the exact query, with `model` marked so it always says
  which model ran. The Response card shows the last final transcript verbatim.

Both settings are Nova-3 models on `/v1/listen`, so the page has one model and the `model` param
is the setting. `/v2/listen?model=nova-3-medical` is a 400 at the handshake, so there is no Flux
option. File upload is off; reading the phrase shows the effect.

## What we saw

An internal report says plain `nova-3` hears "lisinopril" as "listen". That was not reproduced
here: on a synthetic clip (macOS `say`), both models wrote every drug name in the phrase
correctly. The differences were small: `nova-3-medical` wrote "mg" where `nova-3` wrote
"milligrams" on the second sentence, and dropped a leading "the". Real voices, accents, and noisy
rooms are where the medical model should earn its keep; no human has read the phrase into the
page yet.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=nova3-medical pnpm dev
```

## Verified live

From the top of `index.tsx`:

```text
Verified live 2026-11-16: pnpm verify:live opened the /v1/listen socket with model=nova-3 and
model=nova-3-medical (both accepted) and the docs link resolved; on synthetic speech (macOS say)
both models wrote lisinopril, metformin, atorvastatin, amoxicillin clavulanate, and
levothyroxine correctly.
```

Pre-recorded transcripts of the same synthetic clip, verbatim:

- `nova-3-medical`: "patient takes lisinopril ten mg and metformin five hundred mg daily"
- `nova-3`: "the patient takes lisinopril ten mg and metformin five hundred mg daily"
