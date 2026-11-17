# agent-server-functions

**Let Deepgram call your server.** Ask the agent when the store is open. The `get_store_hours`
function carries an `endpoint`, so Deepgram's servers call this site's server for the hours and the
page sends nothing back: the `FunctionCallRequest` arrives marked `client_side: false`. Switch to
"This page answers" and the same function, with no endpoint, runs in the browser instead, the way
[function-calling](../function-calling/) works.

- **Live:** https://dg-devrel-demos.fly.dev/demos/agent-server-functions/
- **Kind:** Voice agent
- **Docs:** https://developers.deepgram.com/docs/voice-agents-function-calling

## What to try

- **Deepgram calls the server.** Press **Start talking** and say "What time are you open on
  Saturday?" The panel under the buttons shows the call with `client_side: false`, then either the
  agent's answer (9:15 am to 4:30 pm, made-up hours only the server knows) or Deepgram's
  `FUNCTION_CALL_FAILED` warning with the HTTP status it got.
- **This page answers.** Switch modes and ask again. Now the call says `client_side: true` and the
  timeline shows the page's `FunctionCallResponse`.

## Not verified yet: the round trip

The endpoint is `https://dg-devrel-demos.fly.dev/demos/agent-server-functions/api/store-hours`, the
deployed site, in every run, local ones included. Deepgram cannot reach `localhost`, and the API
refuses it anyway (`INVALID_SETTINGS`, "Endpoints must use https or wss"). Until this demo is
deployed, that URL is a 404, so server mode ends in `FUNCTION_CALL_FAILED` and the agent says nothing
more. Nobody has yet seen Deepgram call the deployed route and the agent speak its answer. After the
deploy, run server mode once and record what came back here.

What Deepgram POSTs to the endpoint is not in the docs, so `server.js` reads `day` from the top level
of a JSON body, from an `arguments` field (object or JSON string), or from the query string, and
answers with the whole week when it finds none. The route logs the method, content type, and first 300 characters of each body; read the first deployed call in the Fly logs.

## How it works

```
browser                       Deepgram                          server.js (this site)
  │  wss .../v1/agent/converse
  │  Settings: think.functions[0].endpoint = { url, method: post, headers: {} }
  │  ═══ mic audio ═══════════▶ │
  │  ◀── FunctionCallRequest   │  POST /demos/agent-server-functions/api/store-hours
  │      client_side: false     │ ───────────────────────────────▶ │
  │                             │ ◀── {"day":"saturday","hours":...}
  │  ◀═══ agent audio ══════════│
```

- The page never answers a `client_side: false` call. The shell skips it.
- No headers on the endpoint: Settings is built in the browser, so anything there is public. A real
  endpoint that needs auth gets its Settings built on your own server.
- The route has no same-origin check (Deepgram is not the page), is rate limited, takes bodies up to
  4 KB, and returns only made-up hours.

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=agent-server-functions pnpm dev
```

`pnpm vitest run demos/agent-server-functions` tests the route on its own.

## Verified live

Verified live 2026-11-16: verify:live sent Settings in both modes (with the endpoint, and page-answered) with Flux and Nova-3 listen, all four came back SettingsApplied; prompt.md's Settings came back SettingsApplied with a granted token; the docs link resolved. A probe saw FunctionCallRequest client_side false, then FUNCTION_CALL_FAILED 404 from the not-yet-deployed route. The round trip (Deepgram calling the deployed route, the agent speaking the hours) is unverified until deploy.
