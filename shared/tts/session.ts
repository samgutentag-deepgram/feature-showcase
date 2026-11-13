// A session on one Flux socket (wss /v2/speak): the line goes out as turns, one piece each (Speak +
// Flush), the next just before the audio queued ahead of it runs out. Every turn is reported:
// speech_id from SpeechStarted, audio_duration_ms and billable characters from SpeechMetadata.
// A setting from configure() is sent as Configure before the next turn whenever it changes, so a
// pick mid-line lands on the next turn with no reconnect.
// Verified live 2026-11-12, flux-wes-en, linear16 at 24 kHz:
//   Configure {"speed":0.5} between turns -> ConfigureSuccess {"applied":{"speed":0.5}}, and the
//   next turn obeys it (the same sentence: 1.0 -> 5.04 s, 0.5 -> 12.8 s, 1.5 -> 4.0 s).
//   Configure sent while a turn's text was already all in got no answer and changed nothing,
//   which is why the line is split into turns.
//   Each Speak + Flush is a turn of its own: SpeechStarted {speech_id}, Flushed, then
//   SpeechMetadata {speech_id, audio_duration_ms, input_character_count, billable_character_count}.
import { fetchToken } from '../common/config'
import type { Params } from '../common/feature'
import type { TtsFeature } from './feature'
import { mulawToFloat, pcm16ToFloat, speakPath, speakQuery } from './speak'

export interface Turn {
  text: string
  label: string
  // Sent before this turn, and the answer to it.
  configure?: Record<string, unknown>
  configured?: Record<string, unknown>
  speechId?: string
  audioMs?: number
  billableChars?: number
  inputChars?: number
  // From sending the turn to its first sample playing.
  firstAudioMs?: number
}

export interface SessionResult {
  buffers: AudioBuffer[]
  turns: Turn[]
  seconds: number
  firstAudioMs: number
}

export interface SessionPlayback {
  done: Promise<SessionResult>
  stop(): void
}

// Ask for the next turn when less than this much audio is left in the queue.
const LEAD_S = 0.8
// A piece shorter than this joins the next one in its sentence, so no turn is a lone word.
const MIN_CHARS = 18

// Sentences, or with 'phrase' also commas, colons and semicolons.
export function pieces(text: string, split: 'sentence' | 'phrase'): string[] {
  const re = split === 'phrase' ? /[^,;:.!?]+[,;:.!?]+["')\]]*|[^,;:.!?]+$/g : /[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g
  const raw = (text.match(re) ?? [text]).map((s) => s.trim()).filter(Boolean)
  if (split === 'sentence') return raw
  const out: string[] = []
  let held = ''
  for (const r of raw) {
    held = held ? `${held} ${r}` : r
    if (held.length >= MIN_CHARS || /[.!?]["')\]]*$/.test(held)) {
      out.push(held)
      held = ''
    }
  }
  if (held) out.length ? (out[out.length - 1] += ` ${held}`) : out.push(held)
  return out
}

// The socket URL takes only the audio format: settings that change mid-session go in Configure.
export function sessionUrl(voice: string, params: Params, configured: string[]) {
  const query = Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'container' && !configured.includes(k)))
  return `wss://api.deepgram.com${speakPath(voice)}?${speakQuery(voice, query)}`
}

export async function speakSession<S>(
  ctx: AudioContext,
  out: AudioNode,
  voice: string,
  feature: TtsFeature<S>,
  getState: () => S,
  text: string,
  onTurns: (turns: Turn[]) => void,
): Promise<SessionPlayback> {
  const session = feature.session!
  const parts = pieces(text, session.split)
  const token = await fetchToken()
  const state0 = getState()
  const params = feature.params(state0)
  const rate = Number(params.sample_rate ?? 24000)
  const mulaw = params.encoding === 'mulaw'
  const ws = new WebSocket(sessionUrl(voice, params, Object.keys(session.configure?.(state0) ?? {})), ['bearer', token])
  ws.binaryType = 'arraybuffer'

  let stopped = false
  let next = 0
  let firstAudioMs = 0
  let carry: Uint8Array | null = null
  const t0 = performance.now()
  const played: AudioBufferSourceNode[] = []
  const turns: Turn[] = []
  let current: Turn | null = null
  let sentAt = 0
  let turnDone: (() => void) | null = null
  let fail: (e: Error) => void = () => {}
  const failed = new Promise<never>((_, reject) => {
    fail = reject
  })
  failed.catch(() => {})
  const report = () => onTurns(turns.map((t) => ({ ...t })))

  const decode = (value: Uint8Array) => {
    if (mulaw) return Float32Array.from(value, mulawToFloat)
    let data = value
    if (carry) {
      data = new Uint8Array(carry.length + value.length)
      data.set(carry)
      data.set(value, carry.length)
      carry = null
    }
    if (data.length % 2) {
      carry = data.slice(-1)
      data = data.slice(0, -1)
    }
    return pcm16ToFloat(data)
  }

  const play = (samples: Float32Array<ArrayBuffer>) => {
    if (!samples.length || stopped) return
    const buffer = ctx.createBuffer(1, samples.length, rate)
    buffer.copyToChannel(samples, 0)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(out)
    next = Math.max(next, ctx.currentTime + 0.02)
    src.start(next)
    next += buffer.duration
    played.push(src)
    if (current && current.firstAudioMs === undefined) {
      current.firstAudioMs = performance.now() - sentAt
      report()
    }
    if (!firstAudioMs) firstAudioMs = performance.now() - t0
  }

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('Could not open the Deepgram socket. Check your connection and try again.'))
  })
  ws.onclose = (e) => {
    if (!stopped && e.code !== 1000 && e.code !== 1005) fail(new Error(`Deepgram closed the socket (${e.code}). ${e.reason}`.trim()))
  }
  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') return play(decode(new Uint8Array(e.data as ArrayBuffer)))
    const m = JSON.parse(e.data) as Record<string, unknown>
    if (m.type === 'Error' || m.type === 'ConfigureFailure') return fail(new Error(`Deepgram: ${String(m.description ?? m.code ?? m.type)}`))
    if (!current) return
    if (m.type === 'ConfigureSuccess') current.configured = m.applied as Record<string, unknown>
    if (m.type === 'SpeechStarted') current.speechId = String(m.speech_id)
    if (m.type === 'SpeechMetadata') {
      current.audioMs = Number(m.audio_duration_ms)
      current.billableChars = Number(m.billable_character_count)
      current.inputChars = Number(m.input_character_count)
      turnDone?.()
    }
    report()
  }

  const stop = () => {
    stopped = true
    // Release a turn still waiting for its SpeechMetadata, so the run ends as stopped.
    fail(new DOMException('Stopped', 'AbortError'))
    ws.close()
    played.forEach((s) => {
      try {
        s.stop()
      } catch {
        // Already stopped.
      }
    })
  }

  const done = (async (): Promise<SessionResult> => {
    let sentConfig = ''
    try {
      for (const [i, piece] of parts.entries()) {
        if (i > 0) while (!stopped && next - ctx.currentTime > LEAD_S) await new Promise((r) => setTimeout(r, 100))
        if (stopped) throw new DOMException('Stopped', 'AbortError')
        const state = getState()
        const turn: Turn = { text: piece, label: feature.runLabel(state) }
        const config = session.configure?.(state)
        // The first turn sends it too: the socket opens at the default.
        if (config && JSON.stringify(config) !== sentConfig) {
          turn.configure = { type: 'Configure', ...config }
          ws.send(JSON.stringify(turn.configure))
          sentConfig = JSON.stringify(config)
        }
        turns.push(turn)
        current = turn
        sentAt = performance.now()
        const finished = new Promise<void>((r) => {
          turnDone = r
        })
        // A space between turns, since the server adds none.
        ws.send(JSON.stringify({ type: 'Speak', text: i < parts.length - 1 ? `${piece} ` : piece }))
        ws.send(JSON.stringify({ type: 'Flush' }))
        report()
        await Promise.race([finished, failed])
      }
      await new Promise((r) => setTimeout(r, Math.max(next - ctx.currentTime, 0) * 1000 + 50))
      if (stopped) throw new DOMException('Stopped', 'AbortError')
      ws.close()
      const buffers = played.map((s) => s.buffer).filter((b): b is AudioBuffer => !!b)
      return { buffers, turns, seconds: buffers.reduce((s, b) => s + b.duration, 0), firstAudioMs }
    } catch (err) {
      ws.close()
      throw err
    }
  })()

  return { done, stop }
}
