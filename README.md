# Feature showcase

One small live page per Deepgram API feature. Each one shows a single feature or setting doing its
thing, with the exact request on screen, at `https://dg-devrel-demos.fly.dev/demos/<demo>/`. The
whole site is one Fly app, `dg-devrel-demos`; its root lists every demo.

Every demo is one folder under [`demos/`](demos), with its own README. Everything around it (the
page, the token server, mic capture, the sockets, the Request and Response cards, the brand
styles, the Dockerfile and `fly.toml`) lives once in [`shared/`](shared), so the demos look alike
and a new one is mostly a single `index.tsx`. One build makes one real HTML page per demo (its own
title, description, and share card), and one server mints tokens for all of them.

Until 2026-11-16 each demo was its own Fly app at `https://dg-devrel-<demo>.fly.dev`. Those 30 apps
now answer with a 301 to the demo's page here, path and query kept (`redirect/`).

Private (`-lab`). This repo is the single source of truth for the demos; it replaced the 30
separate `<demo>-lab` repos on 2026-11-12.

## Quick start

You need Node 22.9+, Corepack, and a Deepgram key whose role can create temporary tokens (Member
or above) in `.env` as `DEEPGRAM_API_KEY=...` (git-ignored, only the server reads it).

```bash
corepack enable && pnpm install
```

```bash
FEATURE=keyterm pnpm dev
```

Open <http://localhost:8080>; with `FEATURE` set, `/` goes straight to that demo. Every demo is
served either way, at `/demos/<id>/`. A bare `pnpm dev` shows the list at `/`.

| Command | Does |
|---|---|
| `FEATURE=<demo> pnpm dev` | Vite on 8080 and the token server on 8081; `/` opens that demo |
| `pnpm check` | TypeScript over the whole repo |
| `pnpm test` | Unit tests for every demo folder at once (contract, links, prompts, style rules) |
| `pnpm build` | Builds the whole site into `dist/`, one `dist/demos/<id>/index.html` per demo (what `pnpm start` and the image serve). `FEATURE=<demo>` builds only that page |
| `bash scripts/build.sh [<demo>... \| --set <name> \| --all]` | No names: the site. With names: each demo's page on its own, so a broken one is named |
| `bash scripts/check.sh [--no-live] <targets>` | The automated pre-deploy checks, one line per demo |
| `bash scripts/deploy.sh site [--dry-run]` | Checks every demo, then deploys the site |
| `bash scripts/deploy.sh redirects [--dry-run]` | Deploys the redirect image to the 30 old per-demo apps |
| `bash scripts/probe.sh <targets>` | Read-only check of the live pages; `--redirects` checks the old apps |
| `bash scripts/new.sh <demo> [stt\|tts\|agent]` | Starts a new demo folder |
| `UPDATE_PROMPTS=1 pnpm test prompt` | Regenerates every `prompt.md` after a feature change |
| `pnpm og <demo> ...` | Renders a 1200x630 share card (macOS, needs Chrome) |

## The demos

### Speech-to-text

| Demo | What it shows | Live |
|---|---|---|
| [diarize](demos/diarize) | Who said that? | [/demos/diarize/](https://dg-devrel-demos.fly.dev/demos/diarize/) |
| [dictation](demos/dictation) | Say "comma." Get a comma. | [/demos/dictation/](https://dg-devrel-demos.fly.dev/demos/dictation/) |
| [filler-words](demos/filler-words) | Um, did it hear that? | [/demos/filler-words/](https://dg-devrel-demos.fly.dev/demos/filler-words/) |
| [interim-results](demos/interim-results) | Watch it think out loud. | [/demos/interim-results/](https://dg-devrel-demos.fly.dev/demos/interim-results/) |
| [keyterm](demos/keyterm) | Was that Kallistrum or Callistram? | [/demos/keyterm/](https://dg-devrel-demos.fly.dev/demos/keyterm/) |
| [language-hint](demos/language-hint) | Which language was that? | [/demos/language-hint/](https://dg-devrel-demos.fly.dev/demos/language-hint/) |
| [measurements](demos/measurements) | Five kilograms, or 5 kg? | [/demos/measurements/](https://dg-devrel-demos.fly.dev/demos/measurements/) |
| [numerals](demos/numerals) | Twenty five, or 25? | [/demos/numerals/](https://dg-devrel-demos.fly.dev/demos/numerals/) |
| [profanity-filter](demos/profanity-filter) | Keep it clean. | [/demos/profanity-filter/](https://dg-devrel-demos.fly.dev/demos/profanity-filter/) |
| [redact](demos/redact) | Say the card number. Never store it. | [/demos/redact/](https://dg-devrel-demos.fly.dev/demos/redact/) |
| [replace](demos/replace) | Say Acme. Get ACME Corp. | [/demos/replace/](https://dg-devrel-demos.fly.dev/demos/replace/) |
| [smart-format](demos/smart-format) | Four eight one five, or 4815? | [/demos/smart-format/](https://dg-devrel-demos.fly.dev/demos/smart-format/) |
| [turn-detection](demos/turn-detection) | Did it cut you off? | [/demos/turn-detection/](https://dg-devrel-demos.fly.dev/demos/turn-detection/) |

### Text-to-speech

| Demo | What it shows | Live |
|---|---|---|
| [aura-voice-picker](demos/aura-voice-picker) | Hear every Aura-2 voice. | [/demos/aura-voice-picker/](https://dg-devrel-demos.fly.dev/demos/aura-voice-picker/) |
| [flux-tts-configure](demos/flux-tts-configure) | Change the pace without hanging up. | [/demos/flux-tts-configure/](https://dg-devrel-demos.fly.dev/demos/flux-tts-configure/) |
| [flux-tts-turns](demos/flux-tts-turns) | Every turn, accounted for. | [/demos/flux-tts-turns/](https://dg-devrel-demos.fly.dev/demos/flux-tts-turns/) |
| [flux-tts-voices](demos/flux-tts-voices) | Hear every Flux voice. | [/demos/flux-tts-voices/](https://dg-devrel-demos.fly.dev/demos/flux-tts-voices/) |
| [telephone-audio](demos/telephone-audio) | Does it sound like a phone call? | [/demos/telephone-audio/](https://dg-devrel-demos.fly.dev/demos/telephone-audio/) |
| [tts-bit-rate](demos/tts-bit-rate) | How small can the file get? | [/demos/tts-bit-rate/](https://dg-devrel-demos.fly.dev/demos/tts-bit-rate/) |
| [tts-expressivity](demos/tts-expressivity) | Calm for support, bright for good news. | [/demos/tts-expressivity/](https://dg-devrel-demos.fly.dev/demos/tts-expressivity/) |
| [tts-interrupt](demos/tts-interrupt) | Let the caller cut in. | [/demos/tts-interrupt/](https://dg-devrel-demos.fly.dev/demos/tts-interrupt/) |
| [tts-normalize-volume](demos/tts-normalize-volume) | Every voice at the same volume. | [/demos/tts-normalize-volume/](https://dg-devrel-demos.fly.dev/demos/tts-normalize-volume/) |
| [tts-pause-markers](demos/tts-pause-markers) | Give them time to write it down. | [/demos/tts-pause-markers/](https://dg-devrel-demos.fly.dev/demos/tts-pause-markers/) |
| [tts-pronunciation](demos/tts-pronunciation) | Say the drug name right. | [/demos/tts-pronunciation/](https://dg-devrel-demos.fly.dev/demos/tts-pronunciation/) |
| [tts-sample-rate](demos/tts-sample-rate) | How many kilohertz do you need? | [/demos/tts-sample-rate/](https://dg-devrel-demos.fly.dev/demos/tts-sample-rate/) |
| [tts-speed](demos/tts-speed) | Slow down for the numbers. | [/demos/tts-speed/](https://dg-devrel-demos.fly.dev/demos/tts-speed/) |
| [tts-streaming](demos/tts-streaming) | Hear it before it finishes. | [/demos/tts-streaming/](https://dg-devrel-demos.fly.dev/demos/tts-streaming/) |
| [tts-ws-flush](demos/tts-ws-flush) | Start talking before the LLM finishes. | [/demos/tts-ws-flush/](https://dg-devrel-demos.fly.dev/demos/tts-ws-flush/) |

### Voice agent

| Demo | What it shows | Live |
|---|---|---|
| [barge-in](demos/barge-in) | Interrupt it. | [/demos/barge-in/](https://dg-devrel-demos.fly.dev/demos/barge-in/) |
| [context-history](demos/context-history) | Pick up where you left off. | [/demos/context-history/](https://dg-devrel-demos.fly.dev/demos/context-history/) |
| [function-calling](demos/function-calling) | Where is my order? | [/demos/function-calling/](https://dg-devrel-demos.fly.dev/demos/function-calling/) |
| [inject-agent-message](demos/inject-agent-message) | Cut in on your own agent. | [/demos/inject-agent-message/](https://dg-devrel-demos.fly.dev/demos/inject-agent-message/) |
| [think-live](demos/think-live) | It says mhmm. | [/demos/think-live/](https://dg-devrel-demos.fly.dev/demos/think-live/) |
| [update-speak](demos/update-speak) | Change its voice mid-call. | [/demos/update-speak/](https://dg-devrel-demos.fly.dev/demos/update-speak/) |

Sets name groups of demos for `build.sh`, `check.sh`, and `probe.sh`. `stt`, `tts`, and `agent`
are worked out from each folder's `index.tsx`, so a new demo is in its kind's set with no edit.
Hand-picked sets are files in [`sets/`](sets), like `flux-tts` (the three Flux socket demos).

## Make a new demo

`TEMPLATE.md` has the full rules (Flux first, mic only, verified code, link tags). The short path:

1. Pick an id: lowercase words joined by `-`. It becomes the folder, the URL
   (`/demos/<id>/`), and the `utm_source` (`dg-devrel-<id>`). Pick the kind: `stt`, `tts`, or
   `agent`.

2. Start the folder from the smallest example of that kind (smart-format, telephone-audio, or
   barge-in). Nothing else to register: the folder is the page.

   ```bash
   bash scripts/new.sh <id> tts
   ```

3. Fill in `demos/<id>/index.tsx` (the `Feature`, `TtsFeature`, or `AgentFeature`
   object) and `meta.json` (title, description; the URL is already set). Reuse the template
   components below before writing new ones. Feature-only styles go in a `styles.css` in the
   folder, `var(--dg-*)` only.

4. Run it and spot check every setting by hand.

   ```bash
   FEATURE=<id> pnpm dev
   ```

5. Generate the build prompt and the share card, then run the checks.

   ```bash
   UPDATE_PROMPTS=1 pnpm test prompt
   ```

   ```bash
   pnpm og <id> "<headline>" "<one line>" "<query string from the Request card>" "<part to mark>" wave
   ```

   ```bash
   bash scripts/check.sh <id>
   ```

6. Commit, deploy the site (next section), and add it to the index in `devrel-demos-lab/demos.json`.
   No new app or secret: every demo shares the site's.

## Deploy

Deploys are Sam's. The site is one Fly app, `dg-devrel-demos`, deployed from the repo root with
`fly.toml` and `Dockerfile`. Add `--dry-run` to print the `fly deploy` line without running it.

**The site.** Runs `check.sh --all` (types, tests, each page's build, live API checks) and deploys
only if every demo passes, then runs `probe.sh --all`: each page 200, its `og.png` 200,
`/api/token?demo=<id>` 200 same-origin and 403 cross-site. `--no-live` skips the live API checks,
`--skip-checks` skips them all. It refuses an app with no `DEEPGRAM_API_KEY` secret and never
creates apps or secrets.

```bash
bash scripts/deploy.sh site
```

**The redirects.** The 30 demos that had their own app before 2026-11-16 are listed in
`redirect/apps.txt`. Each of those apps runs the same tiny Caddy image (`redirect/`), which sends a
301 to `https://dg-devrel-demos.fly.dev/demos/<id>/` with the path and query kept. The id comes
from the app's own name, so one image fits all. With no names it deploys all 30, then probes each.
Demos added after the move never get an app.

```bash
bash scripts/deploy.sh redirects
```

```bash
bash scripts/deploy.sh redirects keyterm redact
```

The raw commands, if you need them without the script:

```bash
fly deploy . --config fly.toml --app dg-devrel-demos --remote-only --ha=false
```

```bash
cd redirect && fly deploy . --config fly.toml --app dg-devrel-keyterm --remote-only --ha=false
```

### Token limits

Every demo shares one key, so `/api/token?demo=<id>` is limited two ways: per address across every
demo (20 a minute, 120 an hour), and per demo across every address (120 a minute, 2000 an hour by
default; `DEMO_TOKENS_PER_MINUTE` and `DEMO_TOKENS_PER_HOUR` raise them). A run at one demo uses
up that demo's budget and leaves the rest working.

## Template components

Everything a demo can reuse. Every path below is under `shared/`; a demo imports it as
`../../shared/<path>`.

### Pages (one per kind of demo)

| Component | Path | What it does |
|---|---|---|
| `Shell` | `stt/Shell.tsx` | The speech-to-text page: masthead, hero, mode tabs, model toggle (Flux / Nova-3), mic or file capture, Request and Response cards, kept runs (last two side by side), call to action. Used when `kind` is unset |
| `TtsShell` | `tts/TtsShell.tsx` | The text-to-speech page: type or pick a line, pick a voice, set the feature, Speak. Timings, spectrum, Replay, last two runs side by side. Speaks over REST (one voice, or every voice back to back with `lineup`), or over the socket with `cutIn`, `session`, or token modes |
| `AgentShell` | `agent/AgentShell.tsx` | The voice agent page: listen model toggle, Start and talk, agent audio playback, timed event log, mid-call action buttons, last two conversations side by side |
| `mount` | `main.tsx` | Renders a demo's page, picked by the feature's `kind` (`'tts'`, `'agent'`, or none). Each page's generated entry calls it |
| `demo`, `setDemo` | `common/demo.ts` | Which demo this page is, set by its entry at run time: folder, `utm_source`, page path |

### Feature contracts

| Piece | Path | What it does |
|---|---|---|
| `defineFeature`, `Feature<S>` | `common/feature.ts` | The speech-to-text contract: `models`, `modes`, `variants`, `phrases`, `params`, `highlight`, `echo`, `Controls`, `Response`, `Result`, `copy`, `links` |
| `defineTtsFeature`, `TtsFeature<S>` | `tts/feature.ts` | The TTS contract: `voices`, `phrases`, `params`, `variants`, `Controls`, plus optional `cutIn`, `session`, `tokens`, `lineup`, `restartOnPick`, `phoneMark`, `promptState` |
| `defineAgentFeature`, `AgentFeature<S>` | `agent/feature.ts` | The agent contract: `agent` settings, `actions` (mid-call messages with their `ack`), `events`, `functionExample` |
| `LISTEN_MODELS` | `agent/feature.ts` | Flux then Nova-3 as the agent's listen model, behind the shared toggle |
| `settingsMessage` | `agent/feature.ts` | Builds the exact Settings message the agent socket sends and the Request card shows |

### Cards, toggles, pickers, and transcript pieces

| Component | Path | What it does |
|---|---|---|
| `PlainTranscript` | `stt/PlainTranscript.tsx` | A transcript as one block of text, interim words dimmed. Covers most `Result`s |
| `EmptyTranscript` | `stt/PlainTranscript.tsx` | The empty state before the first run |
| `MarkedWords` | `stt/MarkedWords.tsx` | A live transcript that wraps each word matching a regex in `<mark>` (filler words, starred profanity) |
| `LimitDialog` | `stt/LimitDialog.tsx` | The dialog shown when an upload breaks the 1 minute or 1 MB limit |
| `TakeHome` | `common/TakeHome.tsx` | "Build this yourself": copies the demo's generated `prompt.md` for a coding agent |
| `Steps` | `tts/Steps.tsx` | A row of up to five settings, least to most ("Slower" over "0.85x"); a click restarts the line with it |
| Lineup | `tts/lineup.ts`, `tts/loudness.ts` | `lineup: true`: the line in every voice, back to back with a 0.4 s gap, each voice's peak and speech level (dBFS) in a table, and the loudest-to-quietest spread. Linear16, `container=none` only |
| `Spectrum` | `tts/Spectrum.tsx` | Live 0 to 12 kHz frequency bars for whatever is playing, with an optional 4 kHz phone-line mark |
| Voice picker | `tts/TtsShell.tsx` | Built in: the feature's `voices`, grouped Flux then Aura-2, first one is the default |
| Model toggle, mode tabs | `stt/Shell.tsx` | Built in: one tab per `modes` entry (hidden when there is one), one toggle button per `models` entry |
| CSS classes | `styles/app.css` | `.check` (checkbox row), `.segmented` (segmented buttons), `.field` (labeled input), `.note` (small print), `.word`, `.word--pending` |

### Voices

| Export | Path | What it is |
|---|---|---|
| `DEFAULT_VOICE` | `tts/voices.ts` | `flux-wes-en`, the steadiest Flux voice across repeat calls |
| `FLUX_STEADY` | `tts/voices.ts` | Four steady English Flux voices |
| `FLUX_THEN_AURA` | `tts/voices.ts` | `FLUX_STEADY` then two Aura-2 voices, for demos that work on both endpoints |
| `FLUX_SESSION` | `tts/voices.ts` | Six Flux voices for socket session demos |
| `FLUX_INLINE` | `tts/voices.ts` | Six Flux voices checked for inline markup (pauses, IPA) |
| `isFlux`, `speakUrl`, `speakPath`, `voiceName` | `tts/speak.ts` | Routes `flux-*` to `/v2/speak` and `aura-2-*` to `/v1/speak`; a display name from a model id |

### Socket and audio helpers

| Helper | Path | What it does |
|---|---|---|
| `requestParams`, `shownParams`, `toQuery`, `describeRequest` | `common/config.ts` | The one place a speech-to-text request is assembled, so the Request card always matches the socket |
| `PLUMBING`, `MAX_SECONDS`, `MAX_UPLOAD_BYTES`, `SAMPLE_RATE` | `common/config.ts` | Transport params hidden from the card; the hosted limits; 16 kHz capture |
| stream, `parseNova`, `parseFlux`, `finalTranscript`, `closeMessage` | `stt/stream.ts` | Opens the Nova-3 (`/v1/listen`) or Flux (`/v2/listen`) socket and normalizes both into words; readable close errors |
| capture, `readDuration` | `common/capture.ts` + `pcm-worklet.js` | Mic or uploaded file to 16 kHz linear16 PCM; uploads play aloud while they stream |
| `speakQuery`, `replay`, `pcm16ToFloat`, `mulawToFloat` | `tts/speak.ts` | One TTS request played as bytes arrive; decoders for linear16 and mu-law |
| `socketUrl`, `cutMessage` | `tts/socket.ts` | One line over the TTS socket with a cut-in (`Interrupt` on Flux, `Clear` on Aura-2) |
| `sessionUrl`, `pieces` | `tts/session.ts` | A Flux socket session, a turn at a time, with `Configure` between turns |
| `tokenUrl`, `tokenize` | `tts/tokens.ts` | LLM-style token streaming to a Flux voice (whole, stream, late) |
| `LISTEN_URL` | `tts/listen.ts` | Flux STT listener whose `StartOfTurn` triggers a voice cut-in |
| `AGENT_URL`, `INPUT_RATE`, `OUTPUT_RATE` | `agent/feature.ts` | Agent API socket and audio rates |

### Links, prompts, server, and styles

| Piece | Path | What it does |
|---|---|---|
| `dgLink`, `LINKS` | `common/links.ts` | Tags every Deepgram link with `utm_source=dg-devrel-<demo>`, `utm_medium=demo`, `utm_campaign=devrel-demos`, `utm_content=sam_gutentag_<placement>_<button>` |
| `sttPrompt`, `agentPrompt`, `ttsPrompt` | `common/prompt.ts`, `tts/prompt.ts` | Generate `prompt.md` from the feature object; `pnpm test` fails on drift |
| `server.js` | root | Mints 30-second tokens at `/api/token?demo=<id>` (same-origin only, limited per address and per demo), mounts any `demos/<id>/server.js` routes at `/demos/<id>/api/`, and serves `dist/` |
| Style packs | `styles/packs/` | `deepgram-2026.css` (active, light) and `flux-2026.css` (dark alternate). The only place literal colors and fonts may live |
| `theme.css`, `app.css`, `tts.css`, `agent.css` | `styles/`, `tts/`, `agent/` | Tokens and the shared layout every demo uses, so they all look alike |
| og card | `scripts/og/` | Renders the share card from brand fonts and art in `public/materials/` |

## How it fits together

- `vite.config.ts` lists every folder under `demos/` with an `index.tsx` and builds one page per
  folder: `dist/demos/<id>/index.html` from `shared/page.html`, filled from that folder's
  `meta.json`, with its `og.png` and `prompt.md` beside it. The page's entry is generated too: it
  imports the folder and calls `mount`. Shared code is split into common chunks, so each page loads
  only its own demo. `index.html` at the root is the plain list.
- `server.js` serves `dist/`, mints tokens for any demo in the build, and mounts per-demo routes
  from `demos/<id>/server.js` (the Dockerfile copies only those files into the image).
- `fly.toml` names the site app, `dg-devrel-demos`. `redirect/` holds the old apps' image.
- `tests/links.test.ts` checks that every folder's `meta.json` URL is
  `https://dg-devrel-demos.fly.dev/demos/<folder>/` and its `utm_source` is `dg-devrel-<folder>`.
- CI runs `pnpm check`, `pnpm test`, and `pnpm build` on every push.
