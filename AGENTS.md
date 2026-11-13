# AGENTS.md

## What this is

Every one-feature Deepgram demo, in one private repo: one shared page per kind (speech-to-text,
text-to-speech, voice agent) and one folder per demo under `demos/`. A build serves one
demo, picked by `FEATURE`; each demo deploys to its own Fly app, `dg-devrel-<demo>`. See `README.md`
for commands, deploy modes, and the template components list, and `TEMPLATE.md` for the rules a
new demo follows. Each demo folder has its own README.

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

`FEATURE=<demo> pnpm dev` (Vite on 8080, server on 8081, `/api` proxied), `FEATURE=<demo> pnpm build`,
`pnpm start`, `pnpm check`, `pnpm test` (every folder at once), `ONLY=<demo> pnpm verify:live`,
`FEATURE=<demo> pnpm sample` (macOS only, demos with a `make-sample.sh`). Scripts in `scripts/`:
`new.sh`, `build.sh`, `check.sh`, `deploy.sh`, `probe.sh`. Sets of demos are `sets/*.txt`.

Never run `fly deploy` from an agent session; give Sam the `scripts/deploy.sh` command instead.

## Auth

`server.js` mints a 30-second token at `GET /api/token` (same-origin only; 20 a minute and 120 an hour per address).
The browser fetches a fresh token per session and opens the socket with it. `DEEPGRAM_API_KEY`
never reaches the browser. The key needs a role that can call `/v1/auth/grant`; a lower role gets
a 403 from Deepgram, the server returns 500, and the page says it "could not start a session".

## Map

| Path | What |
|---|---|
| `demos/<demo>/` | One demo: `index.tsx`, `meta.json`, `og.png`, `prompt.md`, optional `styles.css` |
| `shared/common/` | Used by every kind: the contract types, request config, token fetch, mic capture, links, prompt builder |
| `shared/stt/` | Speech-to-text page, socket stream, transcript pieces |
| `shared/tts/` | Text-to-speech page, speak/socket/session/token helpers, shared voice lineups |
| `shared/agent/` | Voice agent page and contract |
| `shared/main.tsx` | Picks the page from the feature's `kind` |
| `vite.config.ts` | Reads `FEATURE`, aliases `@feature`, fills `index.html` from `meta.json` |
| `server.js` | Token route and static serving, nothing else |
| `Dockerfile`, `fly.toml` | Shared by every demo; `ARG FEATURE` picks the folder, `--app` the Fly app |
| `scripts/` | `new`, `build`, `check`, `deploy`, `probe`, and `og/` for share cards |
| `sets/` | Named sets of demos for build, check, and deploy |
| `tests/` | Shared tests over every folder, plus `<demo>.test.ts` for demos with their own |

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
