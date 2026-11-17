# UpdatePrompt

**Rewrite its instructions mid-call.** The agent starts as Juniper, a plain, friendly guide. Ask it something, press a style, and ask again: `UpdatePrompt` changes how it answers on the next turn, without reconnecting. The Settings prompt stays. Each new `UpdatePrompt` replaces the last one.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-update-prompt/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agent-update-prompt

## What to try

- **Change its style.** Press **Start talking**, ask "What is your name, and what is a good weekend hobby?", press **Talk like a pirate**, and ask again. `PromptUpdated` lands in the timeline and the answer comes back in pirate talk, still as Juniper.
- **Stack two.** Press **Answer in Spanish** next and ask again. The answer is in Spanish, not pirate Spanish: the panel shows that only the latest `UpdatePrompt` is in effect, on top of the Settings prompt.

## What is sent

```json
{ "type": "UpdatePrompt", "prompt": "From now on, talk like a pirate in every answer." }
```

The server answers `{ "type": "PromptUpdated" }`, in about 0.03 s in testing.

## Append or replace?

The docs say `UpdatePrompt` "will add to – not replace – the current prompt". Live, that holds for the
Settings prompt only:

- The Settings prompt stays. A code word set only in `think.prompt` was still answered after an update.
- A second `UpdatePrompt` replaces the first one's text. After "favorite fruit is MANGO" then "favorite
  color is TEAL", the agent knew TEAL and called the fruit unknown.
- An empty `prompt` is acked and changes nothing.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-update-prompt pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: agent settings, the three `UpdatePrompt` actions, and the panel. The comment at the top records what was verified live |
| [`styles.css`](styles.css) | The prompt panel |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

```text
Verified live 2026-11-16: pnpm verify:live applied the Settings on Flux and Nova-3, each of the three UpdatePrompt actions came back PromptUpdated on both, and the docs link resolved.
```
