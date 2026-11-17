# agent-frustration

**It knows when you are fed up.** Ask the agent a calm question, then complain like it is your third call. Think Live sends `FrustrationDetected` for each annoyed turn with a running `count`, and flips `escalated` to true once the count reaches `agent.think_live.provider.frustration_max_count` (1, 2 or 3 on the page). A counter under the buttons fills up and lists the line that set off each event. Calm turns do not count, and Deepgram does not transfer the call: `escalated` is your app's cue.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-frustration/
- **Docs:** https://developers.deepgram.com/docs/voice-agent-think-live

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-frustration pnpm dev
```

## What we saw

Probed 2026-11-16 with one calm and three angry macOS `say` clips, nine runs, Flux and Nova-3 listening. No event on the calm turn. With defaults, count 1 (escalated false), then count 2 (escalated true), so the server default is 2; the count keeps rising after that with escalated still true. `frustration_max_count: 0` stopped the events, as documented. `presence_check_max_count: 0` also stopped every `FrustrationDetected`, which the docs do not mention, so this page leaves presence checks at their defaults. No aside comes with the event: no `ConversationText` carries a frustration `conversational_behavior`.

## Verified live

Verified live 2026-11-16: verify:live sent all three Settings variants (frustration_max_count 1, 2 and 3) with Flux and Nova-3 listen, all came back SettingsApplied; docs links resolved. Earlier probes with spoken clips got FrustrationDetected on angry turns only, escalated true at the set count.
