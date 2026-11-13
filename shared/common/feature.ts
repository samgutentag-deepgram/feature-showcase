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
  // opt-in per demo, see TEMPLATE.md.
  source: 'mic' | 'file'
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
}

// Identity, for type inference in a feature file.
export const defineFeature = <S,>(f: Feature<S>): Feature<S> => f
