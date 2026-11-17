# UpdateListen

**Teach it a word mid-call.** Say the suggested line once and the agent mishears Kallistrum, a made-up product name. Press **Add keyterm Kallistrum** and say it again: `UpdateListen` gives the agent's speech-to-text the word without reconnecting, `ListenUpdated` lands in the timeline, and the next line reads Kallistrum.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-update-listen/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-update-listen

## What to try

- **Teach it.** Press **Start talking** on Flux, read the line, then press **Add keyterm Kallistrum (Flux)** and read it again. The panel marks Kallistrum on the line after the `ListenUpdated` rule.
- **Undo it.** Press **Clear keyterms** and read the line once more. Keyterms `[]` empties the list.
- **Switch models.** Start on Flux and press a Nova-3 button: the agent now listens with Nova-3, which writes one user line per sentence.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ...}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  mid-call: {"type": "UpdateListen", "listen": {"provider": {..., "keyterms": ["Kallistrum"]}}}
  │  ◀═══ ListenUpdated, agent audio (24 kHz PCM) and events ═
```

- Each `UpdateListen` sends the whole provider: `type`, `version`, `model`, and `keyterms`. A provider
  without `model` is rejected as `UNPARSABLE_CLIENT_MESSAGE`, and keyterms do not carry across a
  model switch.
- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-update-listen pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh site`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: actions, the heard panel, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The heard panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
