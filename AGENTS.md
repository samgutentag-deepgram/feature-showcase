# AGENTS.md

## What this is

Every one-feature Deepgram demo, in one private repo: one shared page per kind (speech-to-text,
text-to-speech, voice agent, LLM) and one folder per demo under `demos/`. One build makes one HTML page
per folder, served by one Fly app at `https://dg-devrel-demos.fly.dev/demos/<demo>/`, with the index
at `/`. A new demo is a new folder plus its entry in `index/demos.json` (and `"built": true` on its
card in `index/coming-soon.json`); `scripts/new.sh` adds both. The 30 demos that predate the single
site (2026-11-16) keep their old apps, `dg-devrel-<demo>`, as 301 redirects (`redirect/`). See
`README.md` for commands, deploy modes, and the template components list, and `TEMPLATE.md` for the
rules a new demo follows. Each demo folder
has its own README.

The browser holds the Deepgram socket through `@deepgram/sdk`; the server only mints tokens.

## Stack (resolved 2026-11-09)

| Package | Version |
|---|---|
| `@deepgram/sdk` | ^5.18.0 (browser `listen.v1` / `listen.v2` sockets, server token grant) |
| react, react-dom | ^19.3.1 |
| vite | ^8.3.7 |
| typescript | ^7.0.2 |
| vitest | ^5.1.0 |
| express | ^5.3.0, with express-rate-limit ^8.7.3 |
| pnpm | 12.18.0 via Corepack |
| Node | >= 22.9 |

## Commands

`FEATURE=<demo> pnpm dev` (Vite on 8080, server on 8081, `/api` proxied, `/` opens that demo),
`pnpm build` (the whole site; `FEATURE=<demo>` builds one page), `pnpm start`, `pnpm check`, `pnpm test` (every folder at once), `ONLY=<demo> pnpm verify:live`,
`FEATURE=<demo> pnpm sample` (macOS only, demos with a `make-sample.sh`). Scripts in `scripts/`:
`new.sh`, `build.sh`, `check.sh`, `deploy.sh` (`site` or `redirects`), `probe.sh`. Sets `stt`, `tts`,
and `agent` come from each folder's `kind`; other sets are `sets/*.txt`.

Never run `fly deploy` from an agent session; give Sam the `scripts/deploy.sh` command instead.
Never press Speak, Replay, or Start in a browser check unless Sam asks: it plays audio out loud.

## Auth

`server.js` mints a 30-second token at `GET /api/token?demo=<id>` (same-origin only; an unknown id is
a 404). Limits: 20 a minute and 120 an hour per address across every demo, and 120 a minute and 2000
an hour per demo across every address (`DEMO_TOKENS_PER_MINUTE`, `DEMO_TOKENS_PER_HOUR`), so a run
at one demo cannot use up the shared key for the rest. The browser fetches a fresh token per
session and opens the socket with it. `DEEPGRAM_API_KEY`
never reaches the browser. The key needs a role that can call `/v1/auth/grant`; a lower role gets
a 403 from Deepgram, the server returns 500, and the page says it "could not start a session".

## Map

| Path | What |
|---|---|
| `demos/<demo>/` | One demo: `index.tsx`, `meta.json`, `og.png`, `prompt.md`, optional `styles.css`, optional `server.js` (routes of its own) |
| `shared/common/` | Used by every kind: the contract types, request config, token fetch, mic capture, links, prompt builder, `demo.ts` (which page this is) |
| `shared/stt/` | Speech-to-text page, socket stream, transcript pieces |
| `shared/tts/` | Text-to-speech page, speak/socket/session/token helpers, shared voice lineups |
| `shared/agent/` | Voice agent page and contract |
| `shared/llm/` | LLM page (Audio and Text Intelligence on `/v1/listen` and `/v1/read`, Deepgram LLMs on `/v1/think`): contract, `plan()` and send code, callback client, prompt builder |
| `shared/llm-starters/` | The two starters `scripts/new.sh <id> llm` and `think` copy; not demos, but `pnpm test` and `verify:live` run them |
| `shared/main.tsx` | `mount(feature, info)`: picks the page from the feature's `kind`; each page's generated entry calls it |
| `shared/page.html` | The HTML every demo page is filled from |
| `index.html`, `index/` | The site root: `index/render.ts` fills `index.html` from `index/demos.json` (live tiles, in order) and `index/coming-soon.json` (backlog cards); `index/main.ts` is the chip and search filter; styles in `shared/styles/index.css` |
| `vite.config.ts` | One page per `demos/<id>/`: fills `shared/page.html` from `meta.json`, generates the entry, ships `og.png` and `prompt.md` beside it |
| `server.js` | Token route, per-demo routes from `demos/<id>/server.js` at `/demos/<id>/api/`, static serving |
| `Dockerfile`, `fly.toml` | The site, app `dg-devrel-demos` |
| `redirect/` | The old per-demo apps' image: Caddy, 301 to `/demos/<id>/`; `apps.txt` lists the 30 |
| `scripts/` | `new`, `build`, `check`, `deploy`, `probe`, and `og/` for share cards |
| `sets/` | Hand-picked sets of demos for build, check, and probe |
| `tests/` | Shared tests over every folder, plus `<demo>.test.ts` for demos with their own; `llm-live.ts` holds the LLM live checks |

## Safeguards

Uploads over 1 MB or 1 minute are refused with a dialog before any audio is sent. A mic run stops
itself at 1 minute. These are client-side; the real ceiling is the limits set on the key.

## Style

Active pack: `shared/styles/packs/deepgram-2026.css`, light, after deepgram.com and the brand starter
kit 2026: off-white page, white cards, Fuchsia pill buttons in uppercase Azeret Mono, Work Sans
600 headlines standing in for Perfektta, dark code cards with hints marked in yellow. Language
colors: Fuchsia, Blue, then Orange for any unhinted language. Material art in `public/materials/`
is cropped from the brand kit's LinkedIn banners (Clay Globe, Glass Waveform). `flux-2026.css` is
kept token-complete as the dark alternate.

> Literal colors, fonts, and radii live only in `shared/styles/packs/`. Everywhere else uses
> `var(--dg-*)`. `pnpm test` enforces this.

## Do not change

- The SDK sockets start closed. `stream.ts` calls `socket.connect()` before `waitForOpen()`;
  removing it means the page connects to nothing and reports nothing.
- Do not offer Catalan, or any language outside `FLUX_LANGUAGES`, on Flux. Sending one returned
  `INTERNAL_SERVER_ERROR` in testing (docs say 400).
- With no hints, omit `language_hint` entirely rather than sending it empty.
- Keep `reconnectAttempts: 0`. A reconnect would reuse an expired 30-second token.
- Build the Request card and the socket query from the same params (`shared/common/config.ts`).
  `tests/features.test.ts` fails if a card shows something the socket does not send.
