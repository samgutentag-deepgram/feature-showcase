# agent-function-filler

**No dead air while it looks it up.** Ask the agent where order 4815 is. The page holds its answer
to `get_order_status` for 3 seconds, like a slow order system. With filler on, the function carries
`initial_agent_filler`, `agent_filler_max_count` and `agent_filler_interval_ms`, and Think Live says
a short line of its own ("Let me find that.") while the call is out. Turn filler off and ask again:
3 seconds of silence. The panel puts the last run of each side by side, timed from the
`FunctionCallRequest`.

Think Live is on in both runs, with backchannels and presence checks at 0, so the filler fields are
the only difference. The filler fields need `agent.think_live`; without it, Settings fails with
`INVALID_SETTINGS`.

Two things seen live that the docs do not say:

- The follow-up filler waited longer than asked. With `agent_filler_interval_ms` 2000 and an 8 s
  wait, the second filler came 4.4 s after the first one stopped, not 2 s.
- The filler line does not always fit the call. Twice it said "Let me look up your recent orders
  using your email address." when the caller had given an order number.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-function-filler/
- **Docs:** https://developers.deepgram.com/docs/voice-agent-think-live#filler-during-function-calls

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-function-filler pnpm dev
```

## Verified live

TODO: what you checked against the API, the date, and what came back (also at the top of index.tsx).

Probed 2026-11-16 (Agent API, gpt-4o-mini, answer held 3 s): filler on gave a ConversationText
tagged `filler` 0.24 to 0.50 s after `FunctionCallRequest` in 7 of 7 runs, Flux and Nova-3
listening, typed and spoken turns. Filler off: nothing for 3 s in 4 of 4 runs. An 8 s wait with
`agent_filler_max_count` 1 and interval 2000 gave a second filler 4.4 s after the first stopped.
