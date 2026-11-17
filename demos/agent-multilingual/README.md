# Multilingual voice agent

**Talk to it in Spanish.** Ask the agent a question in English, then ask it again in Spanish. The
listen model (`flux-general-multi` with `language_hints`) reports the language it heard on every
user turn, the prompt tells the LLM to answer in that language, and the voice says it back.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-multilingual/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/multilingual-voice-agent

## What to try

- **Switch languages mid-call.** Press **Start talking** on Flux multilingual, say "What time do
  you open on Saturday?", wait for the answer, then say "¿A qué hora abren el sábado?". The
  language-per-turn list under the buttons shows `EN` then `ES` with the agent's reply under each.
- **Try the Spanish-only Flux voice.** Pick Flux Carmen and ask in English. Flux voices speak one
  language each, so the English reply comes out in a Spanish voice.
- **Compare Nova-3 multi.** It hears and answers both languages too, but its user
  `ConversationText` has no `languages` field, so the list says so.

## What the page sends

| Piece | Value | Why |
|---|---|---|
| `agent.listen.provider` | `flux-general-multi`, `version: "v2"`, `language_hints: ["en", "es"]` | Hints bias the model toward the languages you expect; it reports `languages` per turn |
| `agent.listen.provider` (Nova-3) | `nova-3`, `version: "v1"`, `language: "multi"` | Code-switching without turn awareness |
| `agent.think.prompt` | "Match the language of each user message independently. Write numbers and times as words in that language." | Without the second sentence, aura-2-selena-es and flux-carmen-es both read "11 AM" in an English reply as "once de la mañana" |
| `agent.speak.provider` | `aura-2-javier-es` with `version: "v1"` (default) or `flux-carmen-es` with `version: "v2"` | Javier is one of five Aura-2 voices that switch between English and Spanish |

Leave out `agent.language`: with `flux-general-multi` it is `INVALID_SETTINGS`. Flux takes no
`language` field in `listen.provider`.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-multilingual pnpm dev
```

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: listen models and hints, the prompt, the voice picker, the language-per-turn panel, copy |
| [`styles.css`](styles.css) | The voice picker and the turn list |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

## Verified live

Verified live 2026-11-16: verify:live sent the Settings message for both voices (aura-2-javier-es v1, flux-carmen-es v2) with both listen models (flux-general-multi with language_hints en and es, nova-3 with language multi), all came back SettingsApplied, and the prompt.md Settings applied with a granted token. A say-clip call on the default Settings heard "What time do you open on Saturday?" as languages ["en"] and answered "We open at eleven on Saturday.", then "¿A qué hora abren el sábado?" as languages ["es"] and answered "Abrimos a las once el sábado.", both in aura-2-javier-es.
