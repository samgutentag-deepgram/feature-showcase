# Function calling

**Where is my order?** Ask the agent about an order. With the function on, it calls get_order_status in this page, gets an answer back, and says it out loud. Turn the function off and ask again: it has nothing to look it up with.

- **Live:** https://dg-devrel-function-calling.fly.dev
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agents-function-calling

## What to try

- **Ask about an order.** Press **Start talking** and say the suggested line. The timeline shows the call, its arguments, and the answer the page sent back.
- **Without the function.** Untick the box and ask again.
- **What we saw in testing.** The agent called `get_order_status` with `{"order_id":"4815"}` and then said "Your order #4815 is out for delivery and is expected to arrive today by 6 PM." The order data is made up by the page.

Headphones help: without them the agent can hear itself through your speakers. Pick Flux or Nova-3
as the agent's listen model with the toggle; Flux is the default.

## How it works

```
browser                          server.js                 Deepgram
  │  GET /api/token  ───────────▶  grant (30 s token) ────▶  /v1/auth/grant
  │  ◀──────────── token
  │  wss agent.deepgram.com/v1/agent/converse
  │  first message: {"type": "Settings", ..., "agent": {"think": {"functions": [...]}}}
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
FEATURE=function-calling pnpm dev
```

Then open <http://localhost:8080>. Deploys go through `bash scripts/deploy.sh function-calling`.

## Files

| File | What |
|---|---|
| [`index.tsx`](index.tsx) | The demo: models, params, controls, copy. The comment at the top records what was verified live |
| [`meta.json`](meta.json) | Title, description, and public URL for the page and its share card |
| [`og.png`](og.png) | 1200x630 share card |
| [`prompt.md`](prompt.md) | Instructions a coding agent follows to add this feature to another app. Generated from `index.tsx`; never edit by hand |

The page around it is shared: [`shared/agent/AgentShell.tsx`](../../shared/agent/AgentShell.tsx). See the
[template components](../../README.md#template-components) for what else a demo can reuse.

## Verified live

From the top of `index.tsx`:

```text
Function calling on the Voice Agent API: the agent asks your code for data mid-conversation.
Verified live 2026-11-10 with synthetic user speech ("Hi, can you tell me where my order is?
The order number is 4815."), Flux as the listen model:
  FunctionCallRequest {"name":"get_order_status","arguments":"{\"order_id\":\"4815\"}","client_side":true}
  the page answered with FunctionCallResponse, and the agent said order 4815 "is out for
  delivery and is expected to arrive today by 6 PM."
The function runs in this page and returns made-up order data.
```
