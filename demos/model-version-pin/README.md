# Model version pin

**Which Nova-3 just wrote that down?** Run the suggested phrase on `version=latest`, then pin an
earlier Nova-3 build, `2025-01-09.0`, and run it again. The Response card shows the
`model_info.version` and `model_uuid` Deepgram reports back, so you can see the pin took.

- **Live:** https://dg-devrel-demos.fly.dev/demos/model-version-pin/
- **Kind:** Speech-to-text (Nova-3 only; Flux answers `version` with a 400)
- **Docs:** https://developers.deepgram.com/docs/version

## What to try

- **The suggested phrase.** Press **Start mic** on **latest** and read it. Then pick
  **Pinned: 2025-01-09.0** and read it again. The two runs sit side by side, each with the build
  that wrote it.
- **The wire.** The Request card shows `version` either way. The Response card shows the
  `model_info` name and version and the `model_uuid` from the last final result.

On a short, clear phrase the words usually match across the two builds; the reported version and
uuid are what change. `latest` moves when Deepgram ships a new build, which is the reason to pin.

## Which versions work

`GET /v1/models` lists every build with its `version`, `uuid`, languages, and whether it streams.
For Nova-3 English streaming, `2025-01-09.0` and the build `latest` resolves to (2025-04-17.21547
on 2026-11-16) are accepted. Builds listed for other language sets (`2025-02-22.5738`,
`2026-01-27.9249`) answer an English request with a 400, "No such model/language/version/tier
combination found".

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=model-version-pin pnpm dev
```

## Verified live

From the top of `index.tsx`:

```text
version on Nova-3: pin the model build a request runs on, and see which build Deepgram says ran.
Checked 2026-11-16 on /v1/listen streaming: version=latest ran general-nova-3 2025-04-17.21547
(uuid 40bd3654-e622-47c4-a111-63a61b23bfe8); version=2025-01-09.0 ran general-nova-3 2025-01-09.0
(uuid bf05427e-a1f1-4ced-a976-38b2f3533d8d). Every Results message carries the same
metadata.model_info and model_uuid as the Metadata message. /v2/listen with version is a 400
("Unknown query parameters: version"). 2025-02-22.5738 and 2026-01-27.9249 are 400s for English
("No such model/language/version/tier combination").
Pre-recorded also takes it: version=2024-12-20.0 ran general-nova-3 2024-12-20.0.
Verified live 2026-11-16: pnpm verify:live opened /v1/listen?model=nova-3&version=latest and
&version=2025-01-09.0 and the prompt URL, all accepted; by hand, latest reported general-nova-3
2025-04-17.21547 and the pin reported 2025-01-09.0 (uuid bf05427e-a1f1-4ced-a976-38b2f3533d8d).
```
