# Agent keyterms

**Did it hear Kallistrum?** A made-up product name trips up any speech model the first time, and the agent then repeats it back wrong. Say the line once without keyterms, then send your product names in the listen provider and say it again.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-keyterms/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/configure-voice-agent

## What to try

- **Without, then with.** Leave **Send keyterms** off, press **Start talking**, and read the suggested line. The agent is told to repeat back the product name it heard, so a miss is audible, and the panel shows what its speech-to-text wrote. Tick **Send keyterms** and read it again: the two runs sit side by side.
- **Your own names.** Type any product names, separated by commas. The suggested line uses them.
- **Flux or Nova-3.** Both listen models take `keyterms`. Flux also gets `version: "v2"`, as the docs show.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"listen": {"provider": {"keyterms": [...]}}}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio (24 kHz PCM) and events ════════════════
```

- The keyterms ride in `agent.listen.provider.keyterms`, one plain string per term. A multi-word name is one entry.
- The panel reads the user's `ConversationText` messages, which carry exactly what the agent's speech-to-text heard.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-keyterms pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: listen fields, agent prompt, controls, panel, copy. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The term input and the heard panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).
