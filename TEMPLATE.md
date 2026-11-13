# Making a new one-feature demo

Each demo is one small public site that shows one Deepgram API feature or setting, live, on a
`dg-devrel-<name>.fly.dev` URL. The page, the token server, capture, the socket, the Request and
Response cards, the clip limits, the brand styles, and the Fly config are **shared** (`shared/`) and stay
put. A demo is one folder under `demos/`, in this one repo. Its folder name is its id, its
Fly app (`dg-devrel-<id>`), and its URL.

There are three kinds of demo, one shared page each. A feature says which with `kind`, and `main.tsx`
picks the page:

| `kind` | Page | The visitor | Example to start from |
|---|---|---|---|
| (none) speech-to-text | `shared/` | talks; sees the transcript | `demos/smart-format/` |
| `'tts'` text-to-speech | `shared/tts/` | types or picks a line; hears it, sees timings and a spectrum | `demos/telephone-audio/` |
| `'agent'` voice agent | `shared/agent/` | talks with an agent; sees the transcript and a timed event log | `demos/barge-in/` |

`demos/language-hint/` is the original, bigger speech-to-text demo (three modes, uploads,
language rows). Start from the smaller examples above. Each is under 100 lines.

Text-to-speech demos list **Flux voices first, then Aura-2 to fill in** (the company push is
Flux). The TTS page sends each voice to its own endpoint: `flux-*` to `/v2/speak`, `aura-2-*` to
`/v1/speak` (Flux on `/v1/speak` is a 400, `V2_MODEL_ON_V1_SPEAK_ENDPOINT`), and the Request card
shows whichever the picked voice uses. Same query params and the same granted token on both
(checked 2026-11-11). The default is `flux-wes-en`, the steadiest of 14 Flux voices across repeat
calls. `flux-marcus-en` and `flux-brittany-en` are cleared for use but drift in pitch and volume
between calls, so `pnpm test` refuses them as the default. `/v2/speak` rejects any query param it
does not know with a 400 (`/v1/speak` silently ignores it), so a 200 there means the param is real.
A TTS feature with `cutIn` speaks over the socket instead (`shared/tts/socket.ts`) and shows Cut
in while the line plays: it stops playback, sends `Interrupt` with `playback_offset` on `/v2/speak`
(Flux answers `SpeechInterrupted` with `text_spoken` and `text_remaining`) or `Clear` on `/v1/speak`,
and speaks the reply on the same socket. Its `params` carry no `container`. `tts-interrupt` is the
example. Agent demos offer Flux and Nova-3 as
the **listen** model, Flux first, through the same toggle.

Every demo starts **live mic only**, with a suggested phrase to read aloud. File upload is an
add-on, decided per demo (step 2).

## 1. Start the folder

Every demo lives in this repo; no new lab repo per demo. Start from the smallest example of its
kind (`stt` copies smart-format, `tts` copies telephone-audio, `agent` copies barge-in):

```bash
bash scripts/new.sh <name> tts
```

That copies the folder, points `meta.json` at `https://dg-devrel-<name>.fly.dev`, drops the
copied `prompt.md`, and adds `<name>` to `sets/<kind>.txt`. The copied `og.png` stays until you
render a new one.

## 2. Write the feature folder

```
demos/<name>/
  index.tsx       default export: defineFeature({...})
  meta.json       title, description, public url, for <title> and the share card
  og.png          1200x630 share image
  make-sample.sh  optional: builds a test clip into samples/ (git-ignored)
```

`index.tsx` fills in `Feature<S>` from `shared/common/feature.ts`. The fields that matter most:

- `models`: each with `endpoint` (`v2` Flux, `v1` Nova), and the `params` a reader copies.
  **The rule (2026-11-10): Flux first, Nova-3 second, whenever Flux supports the feature.** Flux
  supports it if it takes the param, or does the thing on its own (filler words and interim
  updates are built into Flux; say so in the Flux model's `note`). **If Flux does not support it,
  offer Nova-3 only:** one model, no Flux toggle, and the Nova-3 model's `note` starts
  `Nova-3 only. Flux does not support <param> yet`. Check the param on `/v2/listen` live first; a
  400 at the handshake means unsupported. As of 2026-11-10 on `flux-general-en`: `keyterm`,
  `profanity_filter`, `numerals`, `eot_threshold` work; `filler_words` and `interim_results` are
  built in (the param itself is a 400); `redact`, `diarize`, `smart_format`, `dictation`,
  `replace`, `measurements` are unsupported. Anything that changes the transcript (even
  `smart_format=true` for readability) goes in `params`, on the card. `hidden` is only for
  transport plumbing (`PLUMBING` in `shared/common/config.ts`).
- `variants`: every setting the page can be in (every value of every control). The pre-deploy
  checks open each one live on both models.
- `modes`: tabs, each `mic` or `file`. Start with one mic mode; one mode hides the tabs. Set
  `compare: true` to keep the last two runs side by side (file modes do by default).
- `phrases(state, ctx)`: what to read aloud, built from the settings picked right now (the
  terms typed, the kinds ticked, the languages chosen). One line per speaker. Shown by the mic
  button. Every phrase should make the feature's effect visible on the first try.
- `params(state, ctx)`: the feature's own query params. The Request card and the socket both
  build from this, so the card cannot drift from what is sent. Arrays become repeated params.
- `highlight`: which params are marked yellow on the Request card.
- `echo(msg)`: pulls what the Response card shows out of each Deepgram message.
  `finalTranscript(msg)` in `shared/stt/stream.ts` reads a final transcript from either model.
- `Controls`, `Response`, `Result`: three small components. `PlainTranscript` and
  `EmptyTranscript` in `shared/` cover most results.
- Agent demos only, `actions(state)`: messages the visitor sends mid-call (`UpdateSpeak`,
  `InjectAgentMessage`, `UpdatePrompt`), one button each, enabled once `SettingsApplied` arrives.
  Each names the server messages that `ack` it; `pnpm verify:live` sends each one live and waits for
  an ack. The Request card lists them under the Settings message. Think Live lines
  (`conversational_behavior` other than `default`) show as tagged asides and timeline events named
  `ConversationText <behavior>`, so `events` can mark them.
- `copy`, `links`: headline, call to action, and docs link. Link tags are automatic (see
  "Link tags" below).

**Ask: should this demo allow file uploads?** Ask Sam before adding a `file` mode, with a
recommendation. Lean yes when the effect needs audio a visitor cannot easily produce live (two
or more speakers, a language they do not speak, a long or noisy recording) or when comparing the
exact same audio twice is the point. Lean no when one person reading the suggested phrase shows
the effect. Adding uploads is one line in `modes` (`{ id: 'upload', label: 'Upload', source:
'file' }`) plus a `make-sample.sh` for a test clip; the shared page already has the drop zone, the
1 minute / 1 MB limits, and the limit dialog.

Styles: use the shared classes (`.check`, `.segmented`, `.field`, `.note`). If you need more, add a
`styles.css` in the folder and import it from `index.tsx`. `var(--dg-*)` only; `pnpm test`
fails on a literal color or font outside `shared/styles/packs/`.

Share card, from the brand fonts and art (macOS, needs Chrome):

```bash
pnpm og <name> "<headline>" "<one line>" "<query string from the Request card>" "<part to mark>" globe
```

Use `wave` instead of `globe` for the glass waveform art.

## Link tags

Every Deepgram link on the page is tagged by `shared/common/links.ts`, the same way in every demo:

| Param | Value | Answers |
|---|---|---|
| `utm_source` | the demo id, e.g. `dg-devrel-keyterm` | which demo sent this visit |
| `utm_medium` | `demo` | it came from a demo site |
| `utm_campaign` | `devrel-demos` | all one-feature demos, rolled up |
| `utm_content` | `sam_gutentag_<placement>_<button>`, e.g. `sam_gutentag_header_signup` | who built it, where on the page, which button |

The demo id is the first label of `meta.json`'s `url`, set at build time, so it always matches
the Fly app. `tests/links.test.ts` fails if the feature folder, `meta.json`, and `fly.toml`
disagree on the name.

## Pre-deploy checks

Every demo passes all of these before `fly deploy`, and again after any change to what it sends.
Spot check each variant by hand; the rest is automated.

| # | Check | How |
|---|---|---|
| 1 | Types, tests, and build pass | `bash scripts/check.sh <name>` runs 1 to 8 |
| 2 | Every request the page can show is accepted live, on every model, mode, and variant | `ONLY=<name> pnpm verify:live` (all demos without `ONLY`). Speech-to-text: opens the real socket for each (a rejected param fails the handshake). Text-to-speech: requests every voice and variant and checks the audio type. Agent: sends every Settings message with both listen models and waits for `SettingsApplied` |
| 3 | The Request card is exactly what the socket sends, minus transport plumbing | `pnpm test` (`features.test.ts`) |
| 4 | Nothing that changes the transcript is hidden from the card | `pnpm test` (`features.test.ts`) |
| 5 | Flux first when Flux supports the feature; otherwise Nova-3 only, with a note saying so | `pnpm test` (`features.test.ts`) |
| 6 | Folder, `meta.json` url, `fly.toml` app, and `utm_source` all agree | `pnpm test` (`links.test.ts`) |
| 7 | Every Deepgram link has a unique `utm_content` | `pnpm test` (`links.test.ts`) |
| 8 | Docs and changelog links resolve | `pnpm verify:live` |
| 9 | **Spot check each variant by hand**: `pnpm dev`, read the suggested phrase on each model with each setting (or press Speak on each setting, or have each conversation), and confirm the difference the page promises is visible or audible, the Response card shows real response fields, and the console is clean. Agent demos need a real mic and headphones | by hand, about 5 minutes |
| 10 | The copy only claims what check 9 showed, and the "verified" comment at the top of `index.tsx` records the date and what was seen | by hand |
| 11 | Mic only, unless uploads were asked about and agreed | by hand |
| 12 | After deploy: page 200, `/api/token` 200 same-origin and 403 cross-site, and the share card renders | curl and a Slack DM to yourself |

### The build prompt

`prompt.md` in the feature folder tells an AI coding agent how to add this one feature to someone
else's app. It is generated from `index.tsx` by `shared/common/prompt.ts`, so never edit it by hand:

```bash
UPDATE_PROMPTS=1 pnpm test prompt
```

`pnpm test` fails when it drifts from the feature, and `pnpm verify:live` opens every URL and
Settings message it shows with a granted token (an agent feature with `functionExample` also gets
its phrase spoken to the agent, and the call must come back). Text-to-speech prompts come from
`shared/tts/prompt.ts`: each POST they show must come back 200 with audio, and a socket prompt
runs its messages in order, Interrupt included, and must get `text_spoken` back. A TTS feature can
set `promptState` to pick the setting the prompt shows (the last variant otherwise).

## 3. Point the build at it

Nothing to edit. `FEATURE` picks the folder for every command:

```bash
FEATURE=<name> pnpm dev
```

`FEATURE=<name> pnpm build` builds it into `dist/`, and `scripts/deploy.sh` passes it to Docker as
`--build-arg FEATURE=<name>`. A bare `pnpm dev` serves `language-hint`.

## 4. Verify the request is real

Any request string the page shows must be one Deepgram accepts. Before shipping, check the exact
params against the API with your key from `.env` (never paste the key anywhere):

```bash
set -a; . ./.env; set +a; curl -s -H "Authorization: Token $DEEPGRAM_API_KEY" -H 'Content-Type: audio/mpeg' --data-binary @samples/<clip>.mp3 'https://api.deepgram.com/v1/listen?model=nova-3&<your params>'
```

Prerecorded and streaming share query syntax, but not every param works on both; if the feature
is streaming-only, test it on the socket in `pnpm dev`. Then:

```bash
pnpm check && pnpm test
```

```bash
pnpm dev
```

`tests/features.test.ts` checks every folder: meta fields, a 1200x630 `og.png`, a `fly.dev` URL,
and that the Request card is a prefix of what the socket sends for every model and mode.

## 5. Deploy

Once per new demo, create the app and its secret. The API key needs a role that can create
temporary tokens (Member or above).

```bash
fly apps create dg-devrel-<name> --org deepgram
```

```bash
fly secrets set DEEPGRAM_API_KEY=your-key -a dg-devrel-<name>
```

Then deploy. The script runs the automated checks first, deploys only on a pass, and probes the
site after (check 12). The README covers deploying several, a named set, or all of them.

```bash
bash scripts/deploy.sh <name>
```

Then open `https://dg-devrel-<name>.fly.dev`, run a clip, and paste the URL into a Slack DM to
yourself to check the share card.

## Decisions made while building this

- **Shared page and feature, no framework.** One `Feature<S>` object with three small components. No
  registry, no plugin loading, no runtime switching: the feature is picked at build time by a Vite
  alias (`@feature`), so a deployed bundle holds exactly one demo.
- **One repo, one build per demo (2026-11-12).** The 30 labs were folded into this repo: one
  set of shared pages, many demo folders, one shared `fly.toml` with no `app` line, and a Dockerfile that
  takes `ARG FEATURE`. Each demo keeps its own Fly app and URL. `FEATURE` is an env var, not an
  edited line, so no build depends on which folder was last selected.
- **The card is built from the sent params.** `shared/common/config.ts` assembles both the card and
  the socket query from `model.params` + `feature.params()`; `interim_results` (Nova), `hidden`
  params, `encoding` and `sample_rate` are appended after, never shown.
- **smart_format as the second feature**, over `keyterm`. Its effect is visible on any clip with a
  number in it, so a stranger sees the difference on the first try. Verified live on 2026-11-09:
  off gives "four eight one five one six two three four two", on gives "4815162342", "$129.99",
  "(555) 212-8899". `smart_format` is sent either way so the card always says which one ran.
- **Language hint keeps `smart_format=true` as a hidden param**, as it always sent, so its
  transcripts read exactly as before.
- **Token route.** Same-origin only: a request whose `Sec-Fetch-Site` is not `same-origin`, or
  whose `Origin` host differs from `Host`, gets a 403. Clients that send neither (curl) are
  allowed and bounded by the rate limits, since a header check cannot stop them. Limits are 20 a
  minute and 120 an hour per address. TTL stays 30 seconds. No new dependencies.
- **Headers.** `nosniff`, `X-Frame-Options: DENY`, a referrer policy, and a permissions policy
  that allows the mic for this page only.
- **Errors** are sentences that say what to do next, with the close code in parentheses for a bug
  report. Upstream error text never reaches the browser.
- **Nothing internal ships.** Only `dist/` is served; `.dockerignore` keeps `.claude`, `.hub`,
  `advocacy`, `samples`, and `.env` out of the build context.

## Deferred

- **Content-Security-Policy.** Worth adding (`connect-src 'self' wss://api.deepgram.com`), but it
  needs a check against the deployed page and the SDK's exact socket host first.
- **Abuse beyond one address.** The limits are per IP. A spread-out abuser could still mint
  tokens; the real ceiling is the key's own limits in the Deepgram console. A dedicated,
  low-limit key per demo project is the cheap fix.
- **Flux end-of-turn tuning (`eot_threshold`).** Tried and dropped. On a five-turn clip,
  `eot_threshold=0.5` gave 8 turns and `0.9` gave 1, but the 1 came from the remaining turns never
  finalizing before the stream closed, not from tuning. A fair demo needs a longer clip with
  real pauses and a page that waits for Flux's last turn.

- **Shared og art.** Both cards reuse the two brand materials in `public/materials/`. New art per
  demo would need the brand kit.
