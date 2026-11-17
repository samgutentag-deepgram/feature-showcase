# agent-speak-controls

**Set how fast it talks, and how lively.** The agent greets you with one fixed line. Press Speed 0.8, 1.0 or 1.2 and it reads the same line again at that rate, mid-call, through `UpdateSpeak`; a panel times each reply's playback so the change shows in seconds. On a Flux voice, Calm (-2) and Animated (+2) set `expressivity` instead: lower and flatter, or higher and livelier. Pick Flux (Wes) or Aura-2 (Thalia) before Start; `expressivity` is Flux only.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-speak-controls/

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-speak-controls pnpm dev
```

## What the API did (2026-11-16)

- `speed` on Flux (`flux-wes-en`, `version: "v2"`): the greeting ran 9.36 s at 0.5, 5.76 s at 0.8, 5.20 s at 1.0, 3.52 s at 1.2, 2.96 s at 1.5. A value off the 0.05 steps (1.07) or out of range (1.6) is still `SettingsApplied`, then three `SPEAK_REQUEST_FAILED` warnings and `FAILED_TO_SPEAK` when it speaks.
- `speed` on Aura-2 (`aura-2-thalia-en`): 5.68 s at 0.8, 4.40 s at 1.0, 3.68 s at 1.2; 0.5 fails the same way.
- `expressivity` on Flux: -2 to 2 accepted, 0.5 is `UNPARSABLE_CLIENT_MESSAGE`. Length barely moves; pitch does (median 83 Hz and a 2.5 semitone range at -2, 110 Hz and 12.9 st at 0, 188 Hz and 16.8 st at +2). On Aura-2 it is `INVALID_SETTINGS`.
- Both work in `UpdateSpeak` mid-call: `SpeakUpdated`, then the injected line at the new setting.
- `normalize_volume` and unknown fields in `agent.speak.provider` are `UNPARSABLE_CLIENT_MESSAGE`, so they are not offered. Inline pronunciation and pause markup go in the LLM prompt, per the docs, and are left out here.

## Verified live

Verified live 2026-11-16: ONLY=agent-speak-controls pnpm verify:live passed. Both Settings variants (Flux wes with speed 1 and expressivity 0, Aura-2 thalia with speed 1) came back SettingsApplied on Flux and Nova-3 listening, every UpdateSpeak button (Flux: speed 0.8, 1.0, 1.2, expressivity -2 and +2; Aura-2: speed 0.8, 1.0, 1.2) came back SpeakUpdated, and the docs link resolved. Durations and pitch above come from separate live probes the same day.
