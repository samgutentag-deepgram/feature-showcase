// The one place an LLM-kind request is planned and sent. The page and `pnpm verify:live` both call
// these, so the Request card, what the browser sends, and what the live check sends are the same.
// No DOM here: it runs in the browser and in Node (fetch, ReadableStream, TextDecoder).
import { toQuery } from '../common/config'
import type { Json, Params } from '../common/feature'
import {
  LANGUAGE,
  LISTEN_PARAMS,
  LISTEN_URL,
  MAX_TOOL_ROUNDS,
  READ_URL,
  THINK_URL,
  type ChatMessage,
  type Exchange,
  type IntelligenceFeature,
  type Lane,
  type Planned,
  type Source,
  type ThinkBody,
  type ThinkFeature,
  type ToolCall,
} from './feature'

// Gives the Authorization header value for one request: `Bearer <granted token>` in the browser,
// `Token <key>` in the live check. Called once per request, so each gets a fresh token.
export type Auth = () => Promise<string>

// The params an intelligence request sends, in card order.
export function intelligenceParams(params: Params, api: 'listen' | 'read'): Params {
  return api === 'listen' ? { ...LISTEN_PARAMS, ...LANGUAGE, ...params } : { ...LANGUAGE, ...params }
}

export const apiFor = (source: Source): 'listen' | 'read' => (source === 'text' ? 'read' : 'listen')

const pretty = (j: unknown) => JSON.stringify(j, null, 2)

// How the audio is described on the card, and its Content-Type.
export interface AudioInfo {
  note: string
  type: string
}

export const MIC_AUDIO: AudioInfo = { note: 'your recording: 16 kHz mono 16-bit WAV', type: 'audio/wav' }

// A bundled clip's Content-Type, from its file name.
export const audioType = (url: string) =>
  /\.mp3(\?|$)/i.test(url) ? 'audio/mpeg' : /\.ogg(\?|$)/i.test(url) ? 'audio/ogg' : /\.m4a(\?|$)/i.test(url) ? 'audio/mp4' : 'audio/wav'

// /v1/listen with audio, or /v1/read with {"text": ...}.
export function planIntelligence(params: Params, source: Source, text: string, audio: AudioInfo = MIC_AUDIO): Planned {
  const api = apiFor(source)
  const query = toQuery(intelligenceParams(params, api)).toString()
  const url = `${api === 'listen' ? LISTEN_URL : READ_URL}?${query}`
  const path = `/v1/${api}?${query}`
  if (api === 'listen') {
    return { api, url, contentType: audio.type, shown: { line: `POST ${path}`, body: `Content-Type: ${audio.type}\n\n<${audio.note}>` } }
  }
  const body = JSON.stringify({ text })
  return { api, url, contentType: 'application/json', body, shown: { line: `POST ${path}`, body: pretty({ text }) } }
}

export function planThink(body: ThinkBody): Planned {
  return {
    api: 'think',
    url: THINK_URL,
    contentType: 'application/json',
    body: JSON.stringify(body),
    shown: { line: `POST ${THINK_URL}`, body: pretty(body) },
  }
}

// Every think body for this text, one per lane.
export const thinkBodies = <S,>(feature: ThinkFeature<S>, state: S, text: string): ThinkBody[] => [feature.think(state, text)].flat()

// The first request of each lane: what the Request card shows before a run, and what a run sends.
export function plan<S>(
  feature: IntelligenceFeature<S> | ThinkFeature<S>,
  state: S,
  source: Source,
  text: string,
  opts: { callback?: string; audio?: AudioInfo } = {},
): Planned[] {
  if (feature.api === 'think') return thinkBodies(feature, state, text).map(planThink)
  const params = feature.params(state)
  const withCallback = feature.callback && source === 'text' && opts.callback ? { ...params, callback: opts.callback } : params
  return [planIntelligence(withCallback, source, text, opts.audio)]
}

// A sentence a visitor can act on, with the status for a bug report. Deepgram's own error text is
// not shown: it can name internals.
export function statusMessage(status: number): string {
  if (status === 401 || status === 403) return `This demo's key cannot use this API right now. (${status})`
  if (status === 429) return `Deepgram is busy with other requests from this demo. Wait a minute and try again. (${status})`
  if (status === 400) return `Deepgram refused this request. Try a different text or setting. (${status})`
  if (status >= 500) return `Deepgram hit a problem. Try again in a minute. (${status})`
  return `The request did not go through. Try again. (${status})`
}

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail = '',
  ) {
    super(message)
  }
}

// Takes the header value, not Auth: minting a token is not part of the timings.
async function post(planned: Planned, authorization: string, body?: BodyInit): Promise<Response> {
  try {
    return await fetch(planned.url, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': planned.contentType },
      body: body ?? planned.body,
    })
  } catch {
    throw new RequestError('Could not reach Deepgram. Check your connection and try again.', 0)
  }
}

async function failed(res: Response): Promise<RequestError> {
  const detail = (await res.text().catch(() => '')).slice(0, 300)
  return new RequestError(statusMessage(res.status), res.status, detail)
}

// One intelligence request. For listen, pass the audio.
export async function sendOnce(planned: Planned, auth: Auth, audio?: BodyInit): Promise<Exchange> {
  const authorization = await auth()
  const t0 = performance.now()
  const res = await post(planned, authorization, audio)
  if (!res.ok) throw await failed(res)
  const json = (await res.json()) as Json
  return { request: planned, status: res.status, json, ms: Math.round(performance.now() - t0) }
}

// ---- Server-sent events from /v1/think ---------------------------------------------------------

export interface Folded {
  message: ChatMessage
  finishReason?: string
  usage?: Json
  chunks: number
  done: boolean
}

// Folds chat.completion.chunk deltas into one assistant message. Tool-call deltas arrive by index,
// with arguments in pieces.
export function foldChunk(acc: Folded, chunk: Json): Folded {
  const choices = (chunk.choices as Json[] | undefined) ?? []
  if (chunk.usage) acc.usage = chunk.usage as Json
  for (const choice of choices) {
    const delta = (choice.delta as Json | undefined) ?? {}
    if (typeof delta.content === 'string') acc.message.content = (acc.message.content ?? '') + delta.content
    for (const d of (delta.tool_calls as Json[] | undefined) ?? []) {
      const i = typeof d.index === 'number' ? d.index : 0
      const calls = (acc.message.tool_calls ??= [])
      const fn = (d.function as Json | undefined) ?? {}
      const call = (calls[i] ??= { id: '', type: 'function', function: { name: '', arguments: '' } })
      if (typeof d.id === 'string') call.id = d.id
      if (typeof fn.name === 'string') call.function.name += fn.name
      if (typeof fn.arguments === 'string') call.function.arguments += fn.arguments
    }
    if (typeof choice.finish_reason === 'string') acc.finishReason = choice.finish_reason
  }
  acc.chunks++
  return acc
}

export const emptyFold = (): Folded => ({ message: { role: 'assistant', content: null }, chunks: 0, done: false })

// Splits a buffer into complete `data:` payloads and the unfinished rest.
export function sseEvents(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const rest = parts.pop() ?? ''
  const events = parts
    .map((p) =>
      p
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n'),
    )
    .filter(Boolean)
  return { events, rest }
}

// Reads a stream to the end. onDelta gets the message so far after each chunk. A stream that ends
// without [DONE] broke off upstream and is an error, as the docs say.
export async function readStream(res: Response, t0: number, onDelta?: (f: Folded, firstTokenMs?: number) => void) {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  const acc = emptyFold()
  let buffer = ''
  let firstTokenMs: number | undefined
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const { events, rest } = sseEvents(buffer)
    buffer = rest
    for (const data of events) {
      if (data === '[DONE]') {
        acc.done = true
        continue
      }
      const before = (acc.message.content ?? '').length + (acc.message.tool_calls?.length ?? 0)
      foldChunk(acc, JSON.parse(data) as Json)
      const after = (acc.message.content ?? '').length + (acc.message.tool_calls?.length ?? 0)
      if (firstTokenMs === undefined && after > before) firstTokenMs = Math.round(performance.now() - t0)
      onDelta?.(acc, firstTokenMs)
    }
  }
  if (!acc.done) throw new RequestError('The reply stopped before it finished. Try again.', res.status, 'no [DONE]')
  return { acc, firstTokenMs }
}

// One /v1/think request, streamed or not, folded into a message.
export async function sendThink(body: ThinkBody, auth: Auth, onDelta?: (f: Folded, firstTokenMs?: number) => void) {
  const planned = planThink(body)
  const authorization = await auth()
  const t0 = performance.now()
  const res = await post(planned, authorization)
  if (!res.ok) throw await failed(res)
  if (body.stream) {
    const { acc, firstTokenMs } = await readStream(res, t0, onDelta)
    const json: Json = { choices: [{ index: 0, message: acc.message, finish_reason: acc.finishReason }], usage: acc.usage }
    const exchange: Exchange = { request: planned, status: res.status, json, ms: Math.round(performance.now() - t0), firstTokenMs, chunks: acc.chunks }
    return { exchange, message: acc.message, finishReason: acc.finishReason, usage: acc.usage }
  }
  const json = (await res.json()) as Json
  const choice = ((json.choices as Json[] | undefined) ?? [])[0] ?? {}
  const message = (choice.message as ChatMessage | undefined) ?? { role: 'assistant', content: null }
  const exchange: Exchange = { request: planned, status: res.status, json, ms: Math.round(performance.now() - t0) }
  onDelta?.({ message, finishReason: choice.finish_reason as string, usage: json.usage as Json, chunks: 1, done: true })
  return { exchange, message, finishReason: choice.finish_reason as string | undefined, usage: json.usage as Json | undefined }
}

const parseArgs = (s: string): Json => {
  try {
    return JSON.parse(s || '{}') as Json
  } catch {
    return {}
  }
}

// One lane: send the body, answer tool calls with the feature, send again, until the model replies
// with no tool call (or MAX_TOOL_ROUNDS). onUpdate gets the lane after every change.
export async function runThinkLane<S>(
  feature: ThinkFeature<S>,
  state: S,
  first: ThinkBody,
  auth: Auth,
  onUpdate: (lane: Lane) => void = () => {},
): Promise<Lane> {
  const lane: Lane = { title: first.model, exchanges: [], status: 'running', calls: [] }
  let body = first
  for (let round = 0; ; round++) {
    const sent = await sendThink(body, auth, (f, firstTokenMs) => {
      lane.reply = f.message.content ?? ''
      onUpdate({ ...lane, exchanges: [...lane.exchanges, { request: planThink(body), status: 200, ms: 0, firstTokenMs }] })
    })
    lane.exchanges.push(sent.exchange)
    lane.usage = sent.usage
    lane.reply = sent.message.content ?? ''
    const calls: ToolCall[] = sent.message.tool_calls ?? []
    if (!calls.length || !feature.onToolCall || round + 1 >= MAX_TOOL_ROUNDS) break
    const assistant: ChatMessage = { role: 'assistant', content: sent.message.content ?? null, tool_calls: calls }
    const results: ChatMessage[] = calls.map((c) => {
      const args = parseArgs(c.function.arguments)
      const result = feature.onToolCall!(c.function.name, args, state)
      lane.calls!.push({ name: c.function.name, args, result })
      return { role: 'tool', tool_call_id: c.id, content: JSON.stringify(result) }
    })
    body = { ...body, messages: [...body.messages, assistant, ...results] }
    onUpdate({ ...lane })
  }
  lane.status = 'done'
  onUpdate({ ...lane })
  return lane
}

// ---- Reading an intelligence response ----------------------------------------------------------

export interface Segment {
  text: string
  start_word: number
  end_word: number
  topics?: { topic: string; confidence_score: number }[]
  intents?: { intent: string; confidence_score: number }[]
  sentiment?: string
  sentiment_score?: number
}

export interface Analysis {
  // The transcript (listen) or nothing (read: the text is what was sent).
  transcript?: string
  // /v1/listen answers results.summary.short; /v1/read answers results.summary.text.
  summary?: string
  topics?: Segment[]
  intents?: Segment[]
  sentiments?: Segment[]
  average?: { sentiment: string; sentiment_score: number }
}

export function analysis(json: Json | undefined): Analysis {
  const r = ((json?.results as Json | undefined) ?? {}) as Json
  const channels = (r.channels as Json[] | undefined) ?? []
  const alt = ((channels[0]?.alternatives as Json[] | undefined) ?? [])[0]
  const summary = r.summary as Json | undefined
  const segs = (k: string) => ((r[k] as Json | undefined)?.segments as Segment[] | undefined)
  const sentiments = r.sentiments as Json | undefined
  return {
    transcript: typeof alt?.transcript === 'string' ? alt.transcript : undefined,
    summary: (summary?.short ?? summary?.text) as string | undefined,
    topics: segs('topics'),
    intents: segs('intents'),
    sentiments: segs('sentiments'),
    average: sentiments?.average as Analysis['average'],
  }
}

// phoneLLM mini with reasoning on writes its reasoning first, ending in </think>.
export function splitReasoning(content: string): { reasoning?: string; reply: string } {
  const at = content.indexOf('</think>')
  if (at < 0) return { reply: content.trim() }
  return { reasoning: content.slice(0, at).replace(/^<think>/, '').trim(), reply: content.slice(at + 8).trim() }
}

// ---- Audio -------------------------------------------------------------------------------------

// 16-bit mono PCM chunks to a WAV file, for one /v1/listen POST.
export function wav(chunks: ArrayBuffer[], sampleRate: number): ArrayBuffer {
  const bytes = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new ArrayBuffer(44 + bytes)
  const v = new DataView(out)
  const str = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + bytes, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, bytes, true)
  let at = 44
  for (const c of chunks) {
    new Uint8Array(out, at, c.byteLength).set(new Uint8Array(c))
    at += c.byteLength
  }
  return out
}
