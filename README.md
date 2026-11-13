# Feature showcase

One small live page per Deepgram API feature. Each one shows a single feature or setting doing its
thing, with the exact request on screen, at `https://dg-devrel-<demo>.fly.dev`. They are listed on
[dg-devrel-demos.fly.dev](https://dg-devrel-demos.fly.dev).

Every demo is one folder under [`demos/`](demos), with its own README. Everything around it (the
page, the token server, mic capture, the sockets, the Request and Response cards, the brand
styles, the Dockerfile and `fly.toml`) lives once in [`shared/`](shared), so the demos look alike
and a new one is mostly a single `index.tsx`. A build serves exactly one demo, picked by the
`FEATURE` env var, and each demo deploys to its own Fly app.

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

Open <http://localhost:8080>. Any folder name under `demos/` works as `FEATURE`. A bare
`pnpm dev` serves `language-hint`.

| Command | Does |
|---|---|
| `FEATURE=<demo> pnpm dev` | Vite on 8080 and the token server on 8081 for one demo |
| `pnpm check` | TypeScript over the whole repo |
| `pnpm test` | Unit tests for every demo folder at once (contract, links, prompts, style rules) |
| `FEATURE=<demo> pnpm build` | Builds one demo into `dist/` (what `pnpm start` and the image serve) |
| `bash scripts/build.sh <demo>... \| --set <name> \| --all` | Builds each into `dist/<demo>/` |
| `bash scripts/check.sh [--no-live] <targets>` | The automated pre-deploy checks, one line per demo |
| `bash scripts/deploy.sh [--dry-run] <targets>` | Checks, then deploys the ones that pass |
| `bash scripts/probe.sh <targets>` | Read-only check of the live sites |
| `bash scripts/new.sh <demo> [stt\|tts\|agent]` | Starts a new demo folder |
| `UPDATE_PROMPTS=1 pnpm test prompt` | Regenerates every `prompt.md` after a feature change |
| `pnpm og <demo> ...` | Renders a 1200x630 share card (macOS, needs Chrome) |

## The demos

### Speech-to-text

| Demo | What it shows | Live |
|---|---|---|
| [diarize](demos/diarize) | Who said that? | [dg-devrel-diarize](https://dg-devrel-diarize.fly.dev) |
| [dictation](demos/dictation) | Say "comma." Get a comma. | [dg-devrel-dictation](https://dg-devrel-dictation.fly.dev) |
| [filler-words](demos/filler-words) | Um, did it hear that? | [dg-devrel-filler-words](https://dg-devrel-filler-words.fly.dev) |
| [interim-results](demos/interim-results) | Watch it think out loud. | [dg-devrel-interim-results](https://dg-devrel-interim-results.fly.dev) |
| [keyterm](demos/keyterm) | Was that Kallistrum or Callistram? | [dg-devrel-keyterm](https://dg-devrel-keyterm.fly.dev) |
| [language-hint](demos/language-hint) | Which language was that? | [dg-devrel-language-hint](https://dg-devrel-language-hint.fly.dev) |
| [measurements](demos/measurements) | Five kilograms, or 5 kg? | [dg-devrel-measurements](https://dg-devrel-measurements.fly.dev) |
| [numerals](demos/numerals) | Twenty five, or 25? | [dg-devrel-numerals](https://dg-devrel-numerals.fly.dev) |
| [profanity-filter](demos/profanity-filter) | Keep it clean. | [dg-devrel-profanity-filter](https://dg-devrel-profanity-filter.fly.dev) |
| [redact](demos/redact) | Say the card number. Never store it. | [dg-devrel-redact](https://dg-devrel-redact.fly.dev) |
| [replace](demos/replace) | Say Acme. Get ACME Corp. | [dg-devrel-replace](https://dg-devrel-replace.fly.dev) |
| [smart-format](demos/smart-format) | Four eight one five, or 4815? | [dg-devrel-smart-format](https://dg-devrel-smart-format.fly.dev) |
| [turn-detection](demos/turn-detection) | Did it cut you off? | [dg-devrel-turn-detection](https://dg-devrel-turn-detection.fly.dev) |

### Text-to-speech

| Demo | What it shows | Live |
|---|---|---|
| [flux-tts-configure](demos/flux-tts-configure) | Change the pace without hanging up. | [dg-devrel-flux-tts-configure](https://dg-devrel-flux-tts-configure.fly.dev) |
| [flux-tts-turns](demos/flux-tts-turns) | Every turn, accounted for. | [dg-devrel-flux-tts-turns](https://dg-devrel-flux-tts-turns.fly.dev) |
| [flux-tts-voices](demos/flux-tts-voices) | Hear every Flux voice. | [dg-devrel-flux-tts-voices](https://dg-devrel-flux-tts-voices.fly.dev) |
| [telephone-audio](demos/telephone-audio) | Does it sound like a phone call? | [dg-devrel-telephone-audio](https://dg-devrel-telephone-audio.fly.dev) |
| [tts-expressivity](demos/tts-expressivity) | Calm for support, bright for good news. | [dg-devrel-tts-expressivity](https://dg-devrel-tts-expressivity.fly.dev) |
| [tts-interrupt](demos/tts-interrupt) | Let the caller cut in. | [dg-devrel-tts-interrupt](https://dg-devrel-tts-interrupt.fly.dev) |
| [tts-pause-markers](demos/tts-pause-markers) | Give them time to write it down. | [dg-devrel-tts-pause-markers](https://dg-devrel-tts-pause-markers.fly.dev) |
| [tts-pronunciation](demos/tts-pronunciation) | Say the drug name right. | [dg-devrel-tts-pronunciation](https://dg-devrel-tts-pronunciation.fly.dev) |
| [tts-speed](demos/tts-speed) | Slow down for the numbers. | [dg-devrel-tts-speed](https://dg-devrel-tts-speed.fly.dev) |
| [tts-streaming](demos/tts-streaming) | Hear it before it finishes. | [dg-devrel-tts-streaming](https://dg-devrel-tts-streaming.fly.dev) |
| [tts-ws-flush](demos/tts-ws-flush) | Start talking before the LLM finishes. | [dg-devrel-tts-ws-flush](https://dg-devrel-tts-ws-flush.fly.dev) |

### Voice agent

| Demo | What it shows | Live |
|---|---|---|
| [barge-in](demos/barge-in) | Interrupt it. | [dg-devrel-barge-in](https://dg-devrel-barge-in.fly.dev) |
| [context-history](demos/context-history) | Pick up where you left off. | [dg-devrel-context-history](https://dg-devrel-context-history.fly.dev) |
| [function-calling](demos/function-calling) | Where is my order? | [dg-devrel-function-calling](https://dg-devrel-function-calling.fly.dev) |
| [inject-agent-message](demos/inject-agent-message) | Cut in on your own agent. | [dg-devrel-inject-agent-message](https://dg-devrel-inject-agent-message.fly.dev) |
| [think-live](demos/think-live) | It says mhmm. | [dg-devrel-think-live](https://dg-devrel-think-live.fly.dev) |
| [update-speak](demos/update-speak) | Change its voice mid-call. | [dg-devrel-update-speak](https://dg-devrel-update-speak.fly.dev) |

Named sets for build, check, and deploy live in [`sets/`](sets): `stt`, `tts`, `agent`, and
`flux-tts` (the three Flux socket demos). Add a file to make a new set.

## Make a new demo

`TEMPLATE.md` has the full rules (Flux first, mic only, verified code, link tags). The short path:

1. Pick an id: lowercase words joined by `-`. It becomes the folder, the Fly app
   `dg-devrel-<id>`, and the URL. Pick the kind: `stt`, `tts`, or `agent`.

2. Start the folder from the smallest example of that kind (smart-format, telephone-audio, or
   barge-in). This also adds the id to `sets/<kind>.txt`.

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

6. Once per new demo, create its Fly app and secret (Sam runs these; the key comes from `~/.env`):

   ```bash
   fly apps create dg-devrel-<id> --org deepgram
   ```

   ```bash
   fly secrets set DEEPGRAM_API_KEY=your-key -a dg-devrel-<id>
   ```

7. Deploy it (next section), commit, and add it to the index in `devrel-demos-lab/demos.json`.

## Deploy

Every demo deploys from the repo root with the shared `fly.toml` and `Dockerfile`; the script
passes `--app dg-devrel-<demo>` and `--build-arg FEATURE=<demo>`. Before deploying it runs
`check.sh` on the same demos (types, tests, build, live API check) and deploys only the ones that
pass. After deploying it runs `probe.sh`: page 200, `/api/token` 200 same-origin, 403 cross-site.
It never creates apps or secrets, and refuses an app with no `DEEPGRAM_API_KEY` secret.

Add `--dry-run` to any of these to print the `fly deploy` lines without running anything, or
`--skip-checks` to deploy without the checks.

**One demo**

```bash
bash scripts/deploy.sh keyterm
```

**Several by name**

```bash
bash scripts/deploy.sh keyterm redact numerals
```

**A named set** (any `sets/<name>.txt`; repeat `--set` to combine, and mix with names)

```bash
bash scripts/deploy.sh --set tts
```

**All of them**

```bash
bash scripts/deploy.sh --all
```

A set file is one demo id per line; `#` comments and blank lines are ignored. Add a file to make
a new set, for example `sets/launch-week.txt`. A name with no folder stops the run before
anything deploys. `--all` reads the folders under `demos/`, not a set file.

The raw command for one demo, if you need it without the script:

```bash
fly deploy . --config fly.toml --app dg-devrel-keyterm --build-arg FEATURE=keyterm --remote-only --ha=false
```

## Template components

Everything a demo can reuse. Every path below is under `shared/`; a demo imports it as
`../../shared/<path>`.

### Pages (one per kind of demo)

| Component | Path | What it does |
|---|---|---|
| `Shell` | `stt/Shell.tsx` | The speech-to-text page: masthead, hero, mode tabs, model toggle (Flux / Nova-3), mic or file capture, Request and Response cards, kept runs (last two side by side), call to action. Used when `kind` is unset |
| `TtsShell` | `tts/TtsShell.tsx` | The text-to-speech page: type or pick a line, pick a voice, set the feature, Speak. Timings, spectrum, Replay, last two runs side by side. Speaks over REST, or over the socket with `cutIn`, `session`, or token modes |
| `AgentShell` | `agent/AgentShell.tsx` | The voice agent page: listen model toggle, Start and talk, agent audio playback, timed event log, mid-call action buttons, last two conversations side by side |
| `main.tsx` | `main.tsx` | Picks the page from the feature's `kind` (`'tts'`, `'agent'`, or none) |

### Feature contracts

| Piece | Path | What it does |
|---|---|---|
| `defineFeature`, `Feature<S>` | `common/feature.ts` | The speech-to-text contract: `models`, `modes`, `variants`, `phrases`, `params`, `highlight`, `echo`, `Controls`, `Response`, `Result`, `copy`, `links` |
| `defineTtsFeature`, `TtsFeature<S>` | `tts/feature.ts` | The TTS contract: `voices`, `phrases`, `params`, `variants`, `Controls`, plus optional `cutIn`, `session`, `tokens`, `restartOnPick`, `phoneMark`, `promptState` |
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
| `server.js` | root | Mints 30-second tokens at `/api/token` (same-origin only, rate limited) and serves `dist/` |
| Style packs | `styles/packs/` | `deepgram-2026.css` (active, light) and `flux-2026.css` (dark alternate). The only place literal colors and fonts may live |
| `theme.css`, `app.css`, `tts.css`, `agent.css` | `styles/`, `tts/`, `agent/` | Tokens and the shared layout every demo uses, so they all look alike |
| og card | `scripts/og/` | Renders the share card from brand fonts and art in `public/materials/` |

## How it fits together

- `vite.config.ts` reads `FEATURE`, aliases `@feature` to `demos/<FEATURE>/`, fills
  `index.html` from its `meta.json`, and ships its `og.png` and `prompt.md`. A bundle holds one demo.
- `Dockerfile` takes `ARG FEATURE` and refuses to build without a valid one.
- `fly.toml` has no `app` line; `scripts/deploy.sh` supplies it.
- `tests/links.test.ts` checks that every folder's `meta.json` URL is `dg-devrel-<folder>.fly.dev`,
  so the folder, URL, Fly app, and `utm_source` always agree.
- CI runs `pnpm check`, `pnpm test`, and `scripts/build.sh --all` on every push.
