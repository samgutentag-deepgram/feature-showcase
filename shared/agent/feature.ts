// What a voice agent demo plugs into the agent shell. One feature folder exports one of these.
import type { FC, ReactNode } from 'react'
import type { Json } from '../common/feature'

export interface AgentFeature<S> {
  kind: 'agent'
  copy: {
    headline: string
    lede: string
    ctaTitle: string
    ctaBody: ReactNode
  }
  links: { docs: string; changelog?: string }
  initialState: S
  // Every setting the page can be in, for the pre-deploy checks: each Settings message is sent live
  // with each listen model and must be applied without an error.
  variants: S[]
  // The agent: prompt, greeting, functions. The shell adds audio formats and the listen model, so
  // the Request card shows the whole Settings message exactly as sent. A string is the id of an agent
  // configuration stored with the Deepgram REST API, sent as-is in place of the agent block (pair it
  // with listenModels: [], since a stored config carries its own listen).
  agent(state: S): Json | string
  // Keys marked on the Request card, e.g. 'functions'.
  highlight: string[]
  // Events marked in the timeline, e.g. 'UserStartedSpeaking'.
  events: string[]
  // Drop the agent's queued audio when Deepgram says the user started talking.
  flushOnUserSpeech(state: S): boolean
  // Answers a client-side function call. The result is sent back as FunctionCallResponse.content.
  onFunctionCall?(name: string, args: Json, state: S): Json
  // Wait this many ms before sending that FunctionCallResponse, e.g. to stand in for a slow lookup
  // so Think Live filler has a wait to cover. The answer is still worked out at once. Default 0.
  functionDelayMs?(name: string, state: S): number
  // The call the test phrase should produce. prompt.md shows it with its answer, and verify:live
  // speaks the phrase to the agent and checks this call comes back.
  functionExample?: { name: string; args: Json }
  // Messages the visitor sends mid-call, one button each, live once Settings is applied. The Request
  // card lists them under the Settings message, and verify:live sends each one after SettingsApplied.
  actions?(state: S): AgentAction[]
  // Names a run: "barge-in on".
  runLabel(state: S): string
  // What to say, in order. Shown next to the Start button.
  phrases(state: S): string[]
  Controls: FC<{ state: S; setState(next: S): void; busy: boolean }>

  // Everything below is optional and added 2026-11-16. A demo that sets none of it sends exactly
  // what it did before.

  // The listen models the toggle offers, first one picked. Defaults to LISTEN_MODELS (Flux, then
  // Nova-3). One entry hides the toggle. [] hides it and adds no listen block at all: agent() then
  // carries its own, or is a stored config id.
  listenModels?: ListenModel[]
  // Extra agent.listen.provider fields for the model picked, merged after { type, model }:
  // keyterms, version, eot_threshold, eager_eot_threshold, eot_timeout_ms, language,
  // language_hints, smart_format.
  listen?(state: S, model: string): Json
  // Top-level Settings fields, written before audio and agent: tags, mip_opt_out, experimental,
  // flags ({ history: false }).
  settings?(state: S): Json
  // Audio formats other than the default (linear16, 16 kHz in, 24 kHz out). The page encodes the mic
  // and decodes the agent audio to match.
  audio?(state: S): AgentAudio
  // What the server should answer with instead of a plain SettingsApplied. error: this Settings
  // message is meant to fail with that Error code (verify:live checks it does, the prompt skips it).
  // warning: a Warning with that code must arrive, before or after SettingsApplied.
  expects?(state: S): { error?: string; warning?: string }
  // A panel of the demo's own, drawn under the buttons. It sees every server message of the current
  // run (History and LatencyReport included), whether agent audio is playing, and can fire an action
  // by label, e.g. a text box that sends InjectUserMessage, a status light, a latency chart.
  Panel?: FC<AgentPanelProps<S>>
}

export interface ListenModel {
  id: string
  label: string
}

export type AgentEncoding = 'linear16' | 'mulaw' | 'alaw'

export interface AgentAudio {
  // The mic is captured at 16 kHz; 8000 is downsampled from it.
  input: { encoding: AgentEncoding; sample_rate: 16000 | 8000 }
  output: { encoding: AgentEncoding; sample_rate: number; container: 'none' }
}

export interface AgentMessage {
  // Since Start was pressed.
  ms: number
  msg: Json
}

export interface AgentPanelProps<S> {
  state: S
  status: 'idle' | 'connecting' | 'mic' | 'live'
  // Every JSON message the server sent in the current run, in order.
  messages: AgentMessage[]
  // Agent audio is queued or playing on the page right now.
  playing: boolean
  // When the first audio chunk of each agent reply arrived (ms since Start).
  audioStarts: number[]
  // Sends the action with this label, as its button would. patch is merged into the message's top
  // level, e.g. { content: 'typed text' } for InjectUserMessage. Ignored unless the session is live.
  fire(label: string, patch?: Json): void
}

export interface AgentAction {
  label: string
  // Sent as a text frame, exactly as shown on the Request card.
  message: Json
  // Any of these server messages means it landed, e.g. ['SpeakUpdated']. verify:live waits for one.
  // [] means the server sends nothing back (KeepAlive, or ForceEndTurn with no turn in progress):
  // verify:live then checks that no Error or Warning arrives within 3 s.
  ack: string[]
  // Fade out the agent audio still queued on the page when this is sent, e.g. an interrupting line.
  flush?: boolean
  // Sent once an ack comes back, e.g. a line for the agent to say after SpeakUpdated, so the visitor
  // hears the change at once. Faded in like flush when it is an interrupting InjectAgentMessage.
  then?: Json
  // Drawn as the filled button.
  primary?: boolean
  // Stop ('off') or resume ('on') streaming mic audio once this is sent. The mic starts on.
  mic?: 'off' | 'on'
  // Send the message again every this many ms while the mic is off, e.g. KeepAlive every 8000.
  repeatMs?: number
  // No button: only the feature's Panel fires it (a text box, a hold-to-talk control). It is still
  // on the Request card and still sent by verify:live.
  hidden?: boolean
}

export const defineAgentFeature =<S,>(f: AgentFeature<S>): AgentFeature<S> => f

// The listen models the toggle offers. Flux first: it was built for turn-taking.
export const LISTEN_MODELS = [
  { id: 'flux-general-en', label: 'Flux' },
  { id: 'nova-3', label: 'Nova-3' },
]

export const AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse'
export const INPUT_RATE = 16_000
export const OUTPUT_RATE = 24_000

export const DEFAULT_AUDIO: AgentAudio = {
  input: { encoding: 'linear16', sample_rate: INPUT_RATE },
  output: { encoding: 'linear16', sample_rate: OUTPUT_RATE, container: 'none' },
}

export const listenModelsOf = <S,>(feature: AgentFeature<S>): ListenModel[] => feature.listenModels ?? LISTEN_MODELS

// The listen model ids to check a feature with: '' stands for "no listen block" when it has none.
export const listenIdsOf = <S,>(feature: AgentFeature<S>): string[] => {
  const models = listenModelsOf(feature)
  return models.length ? models.map((m) => m.id) : ['']
}

export const audioOf = <S,>(feature: AgentFeature<S>, state: S): AgentAudio => feature.audio?.(state) ?? DEFAULT_AUDIO

// The full Settings message: audio formats, the listen model, and the feature's agent. Optional
// feature hooks add top-level fields, listen provider fields, and other audio formats.
export function settingsMessage<S>(feature: AgentFeature<S>, state: S, listenModel: string): Json {
  const agent = feature.agent(state)
  const listen = listenModel ? { listen: { provider: { type: 'deepgram', model: listenModel, ...feature.listen?.(state, listenModel) } } } : {}
  return {
    type: 'Settings',
    ...feature.settings?.(state),
    audio: audioOf(feature, state),
    agent: typeof agent === 'string' ? agent : { ...agent, ...listen },
  }
}
