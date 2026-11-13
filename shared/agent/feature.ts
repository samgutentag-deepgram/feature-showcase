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
  // the Request card shows the whole Settings message exactly as sent.
  agent(state: S): Json
  // Keys marked on the Request card, e.g. 'functions'.
  highlight: string[]
  // Events marked in the timeline, e.g. 'UserStartedSpeaking'.
  events: string[]
  // Drop the agent's queued audio when Deepgram says the user started talking.
  flushOnUserSpeech(state: S): boolean
  // Answers a client-side function call. The result is sent back as FunctionCallResponse.content.
  onFunctionCall?(name: string, args: Json, state: S): Json
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
}

export interface AgentAction {
  label: string
  // Sent as a text frame, exactly as shown on the Request card.
  message: Json
  // Any of these server messages means it landed, e.g. ['SpeakUpdated']. verify:live waits for one.
  ack: string[]
  // Fade out the agent audio still queued on the page when this is sent, e.g. an interrupting line.
  flush?: boolean
  // Sent once an ack comes back, e.g. a line for the agent to say after SpeakUpdated, so the visitor
  // hears the change at once. Faded in like flush when it is an interrupting InjectAgentMessage.
  then?: Json
  // Drawn as the filled button.
  primary?: boolean
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

// The full Settings message: audio formats, the listen model, and the feature's agent.
export function settingsMessage<S>(feature: AgentFeature<S>, state: S, listenModel: string): Json {
  const agent = feature.agent(state)
  return {
    type: 'Settings',
    audio: {
      input: { encoding: 'linear16', sample_rate: INPUT_RATE },
      output: { encoding: 'linear16', sample_rate: OUTPUT_RATE, container: 'none' },
    },
    agent: { ...agent, listen: { provider: { type: 'deepgram', model: listenModel } } },
  }
}
