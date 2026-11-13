# Redaction

**Say the card number. Never store it.** Read out a test card number or a made-up Social Security number. Pick what to redact, and Deepgram masks it before the transcript reaches your app.

- **Live:** https://dg-devrel-redact.fly.dev
- **Kind:** Speech-to-text (Flux, Nova-3)
- **Docs:** https://developers.deepgram.com/docs/redaction

## What to try

- **The suggested phrase.** With nothing ticked it covers a card, an SSN, and a phone number, all
  test values. Press **Start mic** and read it. Then tick **Card numbers** and **Social Security
  numbers** and read the lines again.
- **Each kind alone.** They catch different things. In testing:

  | `redact=` | Redacted | Left in |
  |---|---|---|
  | `pci` | card number, expiry | CVV, SSN, phone |
  | `ssn` | SSN, and a CVV (labeled `SSN`) | card, phone |
  | `pii` | CVV, SSN, phone | card |
  | `numbers` | everything numeric | nothing |

- **The wire.** The Request card shows the exact query, one `redact=` per kind. The Response card
  shows the last final transcript exactly as Deepgram returned it.

File upload is off in this demo; reading the phrase shows the effect. `FEATURE=redact pnpm sample` still writes
`samples/redact.mp3` for testing the API from the command line.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss /v1/listen?model=nova-3&redact=pci&redact=ssn
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ Results: "My card number is [CREDIT_CARD_1]" ══════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- Redaction happens at Deepgram. The unredacted text never comes back over the socket.
- With nothing ticked, no `redact` param is sent at all.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=redact pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh redact`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`make-sample.sh`](make-sample.sh) | macOS only: builds a test clip into `samples/` (`FEATURE=redact pnpm sample`) |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |
| [`redact.test.ts`](redact.test.ts) | Unit tests for this demo, run by `pnpm test` |
| [`styles.css`](styles.css) | Styles for this demo only, `var(--dg-*)` tokens |

The page around it is shared: [`shared/stt/Shell.tsx`](../../shared/stt/Shell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Redaction on Nova-3: Deepgram swaps sensitive spans for labels like [CREDIT_CARD_1] before the
transcript leaves its servers. Verified live 2026-11-09 on /v1/listen streaming with
samples/redact.mp3 (card, expiry, CVV, SSN, phone):
  redact=pci      card and expiry redacted; CVV, SSN, phone left in
  redact=ssn      CVV and SSN redacted, both labeled SSN; card left in
  redact=pii      CVV, SSN, phone redacted; card left in
  redact=numbers  card, expiry, CVV, SSN, and phone all redacted
Repeated params (redact=pci&redact=ssn) combine.
Flux (flux-general-en, /v2/listen), verified 2026-11-10 with the same sample: redact=numbers
swaps each number for a bare * (no label); pci, ssn and pii answer 400.
```
