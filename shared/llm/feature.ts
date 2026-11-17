// What a text-intelligence or LLM demo plugs into the LLM shell (shared/llm/LlmShell.tsx). One
// feature folder exports one of these. Two APIs, picked with `api`:
//
//   'intelligence'  Audio Intelligence and Text Intelligence: the same query params on
//                   POST /v1/listen (recorded mic audio or a bundled clip, Nova-3) and
//                   POST /v1/read (typed text). summarize, topics, intents, sentiment, custom_*.
//   'think'         Deepgram LLMs (Early Access): POST https://agent.deepgram.com/v1/think with a
//                   Chat Completions body. Streaming, tools, temperature, reasoning_effort, models.
//
// Every request is one HTTP POST from the browser with a granted token as `Authorization: Bearer`
// (CORS allows it; checked 2026-11-16). The Request card and the request come from plan() in
// shared/llm/request.ts, so the card cannot show anything that is not sent.
import type { FC, ReactNode } from 'react'
import type { Json, Params } from '../common/feature'

export type { Json, Params }

// mic: the visitor reads the phrase; the shell records it (up to MAX_SECONDS) and sends the audio
// once, as a WAV, to /v1/listen. Live streaming is not used: topics, intents and summarize are
// refused at the /v1/listen socket handshake, and sentiment is accepted there but returns nothing.
// sample: a short clip bundled with the demo (say so on the page), sent to /v1/listen.
// text: a text box, sent to /v1/read, or as the user message to /v1/think.
export type Source = 'mic' | 'sample' | 'text'

export interface LlmInput {
  id: string
  label: string
  source: Source
}

// A clip bundled in the demo folder: `import clip from './sample.mp3?url'`, then { url: clip, ... }.
export interface Sample {
  url: string
  // Shown on the page, e.g. "A 25-second support call, read by a macOS voice".
  label: string
  // What the clip says, shown beside it.
  script: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ThinkTool {
  type: 'function'
  function: { name: string; description: string; parameters: Json }
}

// The /v1/think body. The endpoint rejects any other top-level field (max_tokens, top_p, ...).
export interface ThinkBody {
  model: string
  messages: ChatMessage[]
  temperature?: number
  reasoning_effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high'
  tools?: ThinkTool[]
  stream?: boolean
  // Required, exactly this, when stream is true.
  stream_options?: { include_usage: true }
  mip_opt_out?: boolean
}

// One POST, exactly as sent. `shown` is what the Request card prints.
export interface Planned {
  api: 'listen' | 'read' | 'think'
  url: string
  contentType: string
  // JSON text for read and think. Audio goes in separately for listen.
  body?: string
  // The card: the request line, then the body (pretty JSON) or a note on the audio.
  shown: { line: string; body: string }
}

// One request and what came back.
export interface Exchange {
  request: Planned
  status: number
  // The JSON response, the callback delivery, or for a stream the chunks folded into one message.
  json?: Json
  // From sending to the full response (or [DONE]).
  ms: number
  // Streams only: from sending to the first content or tool-call delta.
  firstTokenMs?: number
  chunks?: number
}

// One conversation. An intelligence run has one lane; a think feature whose think() returns an
// array runs one lane per body, in parallel (model compare).
export interface Lane {
  title: string
  exchanges: Exchange[]
  // think: the final assistant text. intelligence: unused.
  reply?: string
  // think: every tool call the model made, with what the page answered.
  calls?: { name: string; args: Json; result: Json }[]
  usage?: Json
  // read callback: the request_id Deepgram answered with, and the delivery when it lands.
  callback?: { requestId: string; acceptedMs: number; afterMs?: number; method?: string }
  status: 'running' | 'done' | 'error'
  error?: string
}

export interface LlmRun<S> {
  id: number
  label: string
  input: LlmInput
  state: S
  // What was analyzed or asked: the typed text, the sample script, or "(N s of mic audio)".
  text: string
  lanes: Lane[]
}

interface Base<S> {
  kind: 'llm'
  copy: {
    headline: string
    lede: string
    ctaTitle: string
    ctaBody: ReactNode
  }
  links: { docs: string; changelog?: string }
  // Tabs, first is the default. One input hides the tabs. think features take text only.
  inputs: LlmInput[]
  initialState: S
  // Every setting the page can be in. verify:live sends each one, on every input.
  variants: S[]
  // Query params (intelligence) or top-level body keys (think) marked on the Request card.
  highlight: string[]
  // Keep the last two runs side by side.
  compare?: boolean
  // Names a run: "summarize on".
  runLabel(state: S): string
  // Suggested text for the text input, first one prefilled; the rest are chips. verify:live sends
  // the first. Make the effect visible: summarize needs more than 50 words or it echoes the input.
  texts(state: S): string[]
  // What to read aloud on a mic input. verify:live speaks it with Aura-2 and sends that audio.
  phrases?(state: S): string[]
  sample?: Sample
  Controls: FC<{ state: S; setState(next: S): void; busy: boolean }>
  // The Response card's content. Defaults to the fields that matter for the API.
  Response?: FC<{ state: S; latest?: LlmRun<S> }>
  // One run's panel. Defaults to the transcript and analysis, or the reply per lane.
  Result?: FC<{ state: S; run?: LlmRun<S> }>
}

export interface IntelligenceFeature<S> extends Base<S> {
  api: 'intelligence'
  // The feature's params, sent on both endpoints. The shell puts `language=en` first (required by
  // /v1/read) and, on /v1/listen only, `model=nova-3&smart_format=true`. All shown on the card.
  params(state: S): Params
  // read-callback: the shell opens a slot on demos/<id>/server.js (POST api/callback), sends its URL
  // as `callback`, and polls GET api/callback/<id> until Deepgram delivers. /v1/read only.
  callback?: boolean
}

export interface ThinkFeature<S> extends Base<S> {
  api: 'think'
  // The whole body for this text. An array runs each body as its own lane, at the same time.
  think(state: S, text: string): ThinkBody | ThinkBody[]
  // Answers a tool call. The shell sends the result back as a tool message (JSON-encoded) with the
  // same tools, up to 3 rounds, and shows each request on the card.
  onToolCall?(name: string, args: Json, state: S): Json
  // The call the first text should produce. verify:live checks it comes back; prompt.md shows it.
  toolExample?: { name: string; args: Json }
}

export type LlmFeature<S> = IntelligenceFeature<S> | ThinkFeature<S>

export const defineLlmFeature = <S,>(f: LlmFeature<S>): LlmFeature<S> => f

export const READ_URL = 'https://api.deepgram.com/v1/read'
export const LISTEN_URL = 'https://api.deepgram.com/v1/listen'
export const THINK_URL = 'https://agent.deepgram.com/v1/think'

// What /v1/listen adds before the feature's params: the model that transcribes, and readable text.
export const LISTEN_PARAMS: Params = { model: 'nova-3', smart_format: 'true' }
// Required on /v1/read (a 400 without it); sent on /v1/listen too so the two cards match.
export const LANGUAGE: Params = { language: 'en' }

export const THINK_MODELS = [
  { id: 'think-fast', label: 'Think-Fast' },
  { id: 'phonellm-mini-alpha-2-fp8', label: 'phoneLLM mini' },
]

// The tool rounds one run may take before the shell stops asking.
export const MAX_TOOL_ROUNDS = 3
