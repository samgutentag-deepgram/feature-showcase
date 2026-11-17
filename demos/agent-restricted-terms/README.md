# Agent restricted terms

**Keep words out of its mouth.** Think Live checks in when you go quiet, and it almost always asks "are you still there?" Ban "still" and "there" with `restricted_terms` and stay silent again: the check-ins come back reworded. Run it both ways and compare the two transcripts.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-restricted-terms/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-think-live

## What to try

- **Restricted.** Leave **Restrict "still" and "there"** ticked, press **Start talking**, and say nothing after the greeting. Three `presence_check` asides arrive about 6 seconds apart, worded without either word ("I'm here whenever you're ready."). The panel counts how many used one.
- **Not restricted.** Untick it and do the same. The field is left out, so the default list (`["human", "transfer"]`) applies, and the check-ins go back to "Are you still there?". Both runs stay side by side.
- **What it does not do.** No message says a term was held back, and your LLM is not bound by it: only the Think Live model's own lines (backchannels, presence checks, filler) avoid the words.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think_live": {"provider": {"restricted_terms": [...]}}}}
  │  ═══ 16 kHz PCM from the mic ═══════════════════════════▶
  │  ◀═══ agent audio (24 kHz PCM) and events ════════════════
```

- The server mints a short-lived token for this page only, and does nothing else. Your key never
  reaches the browser, and audio never touches the server.
- The Request card shows the whole Settings message exactly as sent. The timeline shows every event
  with its time.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-restricted-terms pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: Settings, controls, copy, and the panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The panel that checks each Think Live line for the two words |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx).

## Verified live

From the top of `index.tsx`:

```text
Think Live restricted_terms: words the Think Live model will not say in its own lines.
Probed live 2026-11-16 on the Agent API, gpt-4o-mini thinking, silent mic audio, presence checks
every 3 s (count 3):
  Default list (field left out), Flux listening, 3 runs: 8 presence checks, every one used "still"
  or "there" ("Still on the line?", "Hello? Are you still there?", "Are you still with me?").
  restricted_terms ["still", "there"], Flux 3 runs and Nova-3 1 run: 8 presence checks, none used
  either word ("I'm here whenever you're ready.", "Did you need anything else?").
  No Warning or other message says a term was held back; only the wording changes.
  The reasoning LLM is not bound, as the docs say: restricted ["refund"], InjectUserMessage "Can I
  get a refund on my order?", reply "...assist you with the refund process."
  restricted_terms [] applied fine. A string instead of an array: Error UNPARSABLE_CLIENT_MESSAGE.
Verified live 2026-11-16: verify:live sent both Settings variants (restricted_terms ["still", "there"] and left out) with Flux and Nova-3 listen, all came back SettingsApplied; prompt.md requests worked with a granted token; docs links resolved.
```
