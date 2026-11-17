// What a demo plugs into the shell. One feature folder exports one of these, and the line in
// vite.config.ts that names the folder picks which one a build serves.
import type { FC, ReactNode } from 'react'

// Query params as the socket sends them. An array becomes a repeated param (a=1&a=2).
export type Params = Record<string, string | string[]>

export type Json = Record<string, unknown>

export interface Model {
  id: string
  label: string
  // v1 is /v1/listen (Nova). v2 is /v2/listen (Flux).
  endpoint: 'v1' | 'v2'
  // The params a reader would copy. Shown on the Request card and sent.
  params: Params
  // Sent but not shown. Transport plumbing only (see PLUMBING in config.ts): anything that changes
  // the transcript goes in params, so a reader who copies the card gets the same result.
  hidden?: Params
  // Shown under the controls while this model is picked.
  note?: string
}

export interface Mode {
  id: string
  label: string
  // mic streams the microphone (the default every demo starts with). file streams an upload; it is
  // opt-in per demo, see TEMPLATE.md. sample sends the bundled clip in `sample` (no upload UI).
  source: 'mic' | 'file' | 'sample'
  // Pre-recorded instead of streaming: one POST to /v1/listen with the whole clip (a mic recording
  // up to BATCH_MAX_SECONDS, wrapped as WAV; the file; or the sample), for features the socket
  // refuses. v1 models only. See "Speech-to-text extensions" in TEMPLATE.md.
  batch?: boolean
  // source 'sample' only: the clip, imported from the demo folder (`import clip from './x.mp3'`).
  sample?: { url: string; name: string }
  // Keep the last two runs side by side so a visitor can compare settings. Defaults to true for
  // file modes and false for mic modes.
  compare?: boolean
}

export interface Word {
  text: string
  // BCP-47 tag when Deepgram returns one (Nova-3 multilingual, Flux multi), otherwise ''.
  lang: string
  // Speaker index when the request has diarize_model set (Nova only).
  speaker?: number
  // Channel index when the audio has more than one channel (multichannel=true).
  channel?: number
  // True on the last word of a turn: a Nova result with speech_final, or a Flux EndOfTurn.
  endsTurn?: boolean
  pending?: boolean
}

// One pass over the audio, with the settings it ran with.
export interface Run<S> {
  id: number
  label: string
  model: Model
  mode: Mode
  state: S
  committed: Word[]
  pending: Word[]
  // The latest non-empty value feature.echo pulled out of a message for this run.
  echoed: unknown
  // What happened, in order: server messages, and the messages the page sent. Recorded only for a
  // feature with `timeline` or `actions`, or a batch mode; empty otherwise.
  events: SttEvent[]
}

export interface Ctx {
  model: Model
  mode: Mode
  busy: boolean
}

export interface Feature<S> {
  // Speech-to-text, the default. Text-to-speech features use shared/tts/feature.ts instead.
  kind?: 'stt'
  copy: {
    headline: string
    lede: string
    ctaTitle: string
    ctaBody: ReactNode
  }
  links: { docs: string; changelog?: string }
  // One model hides the toggle.
  models: Model[]
  modes: Mode[]
  initialState: S
  // Every setting the page can be in, for the pre-deploy checks: each one is opened live on every
  // model and mode. Cover every value of every control. Defaults to [initialState].
  variants?: S[]
  // Runs when the visitor flips the model, for settings the new model would reject.
  onModelChange?(state: S, model: Model): S
  // The feature's own params. Shown on the Request card after the model's params, and sent.
  params(state: S, ctx: Ctx): Params
  // Params marked on the Request card.
  highlight: string[]
  // Names a run, after the model: "Nova-3, no hints".
  runLabel(state: S, ctx: Ctx): string
  // The Run button on a file mode. Defaults to "Run".
  actionLabel?(state: S, ctx: Ctx): string
  // Shown after the first run of a file, to invite a second one to compare.
  compareTip?(state: S, ctx: Ctx): string
  // Something to read aloud that shows off the current settings, one line per speaker. Shown next
  // to the mic button.
  phrases?(state: S, ctx: Ctx): string[]
  // Pulls what the Response card shows out of each Deepgram message. Undefined keeps the last value.
  echo?(msg: Json, model: Model): unknown
  Controls: FC<{ state: S; setState(next: S): void; ctx: Ctx }>
  // The Response card's content. latest is the newest run, if there is one.
  Response: FC<{ state: S; ctx: Ctx; latest?: Run<S> }>
  // One transcript panel. With no run yet it renders the empty state.
  Result: FC<{ run?: Run<S>; state: S; ctx: Ctx; live: boolean }>

  // Speech-to-text extensions (2026-11-16), all optional. See TEMPLATE.md.
  // Messages the visitor sends mid-stream, one button each, live while the socket is open. The
  // Request card lists them under the query; verify:live sends each one and waits for its ack.
  actions?(state: S, ctx: Ctx): SttAction[]
  // Record server messages in a timeline under each run. `mark` highlights events by name (see
  // shared/stt/events.ts), `quiet` hides chatty ones (DEFAULT_QUIET when unset). With a timeline,
  // echo() sees every server message, not only transcripts.
  timeline?: { mark: string[]; quiet?: string[] }
  // The audio actually streamed, when it should differ from what the params declare (to show a
  // mismatch). Without it the page sends what `encoding` and `sample_rate` say (linear16, 16 kHz).
  audio?(state: S, ctx: Ctx): AudioFormat
  // Batch modes only: the feature's params carry `callback: CALLBACK_SHOWN`; the page swaps in a
  // slot from demos/<id>/server.js, POSTs, and polls the slot for the transcript Deepgram delivers.
  callback?: boolean
  // The setting prompt.md shows. Without it the prompt picks the variant that sends the most.
  promptState?: S
}

// Identity, for type inference in a feature file.
export const defineFeature = <S,>(f: Feature<S>): Feature<S> => f

// ---- Speech-to-text extensions (2026-11-16) -------------------------------------------------------

export type { AudioFormat } from '../stt/audio'
import type { AudioFormat } from '../stt/audio'

// One timeline entry. name is eventName(msg) for a server message ("EndOfTurn", "Results
// from_finalize", "Metadata"), or the sent message's type (sent: true).
export interface SttEvent {
  ms: number
  name: string
  detail?: string
  sent?: boolean
  msg?: Json
}

export interface SttAction {
  label: string
  // Sent as a text frame, exactly as shown on the Request card. Omit for an audio-only action.
  message?: Json
  // Event names that answer it (prefix match: 'Results' matches 'Results from_finalize'). The
  // button shows which came back and how fast; verify:live waits for one. Omit when none comes
  // (KeepAlive): verify:live then checks the socket stays open with no Error.
  ack?: string[]
  // Stop or start sending mic audio. The mic keeps running; nothing reaches the socket while paused.
  audio?: 'pause' | 'resume'
  // Resend `message` every this many ms until another action runs or the run ends (KeepAlive).
  every?: number
  // The run ends after this message (CloseStream): capture stops and the page waits for the close.
  ends?: boolean
  // Drawn as the filled button.
  primary?: boolean
}
