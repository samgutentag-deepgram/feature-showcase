// One line spoken over the text-to-speech socket, then the socket closed while the audio is still
// coming, the way an app hangs up once it has sent its last line. Two ways to close:
//   graceful: send {"type":"Close"}. Deepgram finishes the text it already has, streams all of
//             that audio, then closes the socket itself (1000).
//   drop:     the client closes the socket (ws.close()). Whatever had not arrived yet is gone.
// Verified live 2026-11-13, Speak (no Flush) then the close 600 ms later, a 195-character line,
// linear16 at 24 kHz, two runs each:
//   /v2/speak flux-wes-en, Close    9.2-9.9 s of audio after Close, then SpeechMetadata and
//                                   SessionMetadata (195 billable characters), then close 1000
//   /v2/speak flux-wes-en, drop     0.6-0.7 s of audio in all, nothing after the close, 1000
//   /v1/speak aura-2-thalia-en, Close  7.6-7.7 s of audio after Close, no message, then close 1000
//   /v1/speak aura-2-thalia-en, drop   1.7 s of audio in all, nothing after; Node saw 1006
// Close drains the text without a Flush: no Flush was sent in any of these runs.
import { fetchToken } from '../common/config'
import type { Params } from '../common/feature'
import type { TtsFeature } from './feature'
import { mulawToFloat, pcm16ToFloat, type Result } from './speak'

export const CLOSE_MESSAGE = { type: 'Close' } as const

// Close mode: the feature's close, when it ends the line mid-way (afterMs after Speak) rather than
// after a session's last turn. graceful defaults to sending Close.
export function closeMidLine<S>(f: TtsFeature<S>) {
  const c = f.close
  if (!c || f.session || c.afterMs === undefined) return undefined
  return { afterMs: c.afterMs, graceful: (s: S) => c.graceful?.(s) ?? true }
}

// SessionMetadata, Flux's last message after Close: totals for every turn on the socket. Verified
// live 2026-11-13 (see shared/tts/session.ts): each total is the sum of the turns' SpeechMetadata.
// Aura-2 (/v1/speak) sends no message after Close, only the rest of the audio and the close.
export interface SessionTotals {
  audioMs: number
  inputChars: number
  billableChars: number
  // From sending Close to SessionMetadata arriving.
  afterCloseMs: number
}

export const sessionTotals = (m: Record<string, unknown>, afterCloseMs: number): SessionTotals => ({
  audioMs: Number(m.total_audio_duration_ms),
  inputChars: Number(m.total_input_character_count),
  billableChars: Number(m.total_billable_character_count),
  afterCloseMs,
})

// The two ways to end the socket: Close lets Deepgram finish and close it (1000); dropping it from
// the client loses whatever had not arrived.
export function closeSocket(ws: WebSocket, graceful: boolean) {
  if (graceful) ws.send(JSON.stringify(CLOSE_MESSAGE))
  else ws.close(1000)
}

export interface CloseStats {
  graceful: boolean
  // From the socket opening.
  closeSentMs: number
  firstAudioMs: number
  // When the socket actually closed, and how.
  closedMs: number
  code: number
  // Audio that had arrived when the close went out, and after it.
  beforeS: number
  afterS: number
  // Text messages that came in after the close went out, as received.
  after: Record<string, unknown>[]
  // Flux only: SessionMetadata, if it came before the close.
  totals?: SessionTotals
}

export interface ClosePlayback {
  done: Promise<Result & { close: CloseStats }>
  stop(): void
}

export async function speakThenClose(
  ctx: AudioContext,
  out: AudioNode,
  url: string,
  params: Params,
  text: string,
  graceful: boolean,
  afterMs: number,
): Promise<ClosePlayback> {
  const token = await fetchToken()
  const rate = Number(params.sample_rate ?? 24000)
  const mulaw = params.encoding === 'mulaw'
  const bytesPerSec = rate * (mulaw ? 1 : 2)
  const ws = new WebSocket(url, ['bearer', token])
  ws.binaryType = 'arraybuffer'

  let t0 = 0
  let closeSentMs = 0
  let firstAudioMs = 0
  let bytes = 0
  let before = 0
  let next = 0
  let stopped = false
  let carry: Uint8Array | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const after: Record<string, unknown>[] = []
  let totals: SessionTotals | undefined
  const played: AudioBufferSourceNode[] = []

  let finish: (r: Result & { close: CloseStats }) => void = () => {}
  let fail: (e: Error) => void = () => {}
  const done = new Promise<Result & { close: CloseStats }>((res, rej) => {
    finish = res
    fail = rej
  })

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

  const silence = () =>
    played.forEach((s) => {
      try {
        s.stop()
      } catch {
        // Already stopped.
      }
    })

  ws.onopen = () => {
    t0 = performance.now()
    ws.send(JSON.stringify({ type: 'Speak', text }))
    timer = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      closeSentMs = performance.now() - t0
      before = bytes
      closeSocket(ws, graceful)
    }, afterMs)
  }
  ws.onerror = () => {
    if (!closeSentMs) fail(new Error('Could not open the Deepgram socket. Check your connection and try again.'))
  }
  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') {
      const value = new Uint8Array(e.data as ArrayBuffer)
      bytes += value.byteLength
      const samples = decode(value)
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
      if (!firstAudioMs) firstAudioMs = performance.now() - t0
      return
    }
    const m = JSON.parse(e.data) as Record<string, unknown>
    if (m.type === 'Error') {
      fail(new Error(`Deepgram: ${String(m.description ?? m.err_msg ?? m.code ?? 'error')}`))
      ws.close()
      return
    }
    if (m.type === 'SessionMetadata') totals = sessionTotals(m, performance.now() - t0 - closeSentMs)
    if (closeSentMs) after.push(m)
  }
  ws.onclose = (e) => {
    clearTimeout(timer)
    if (stopped) return
    if (!closeSentMs) {
      fail(new Error(`Deepgram closed the socket before the page did (${e.code}). ${e.reason}`.trim()))
      return
    }
    const closedMs = performance.now() - t0
    // Settle once whatever arrived has finished playing.
    const wait = Math.max(next - ctx.currentTime, 0) * 1000 + 50
    setTimeout(() => {
      if (stopped) return
      const buffers = played.map((s) => s.buffer).filter((b): b is AudioBuffer => !!b)
      const seconds = bytes / bytesPerSec
      finish({
        stats: { contentType: mulaw ? `audio/mulaw;rate=${rate}` : `audio/l16;rate=${rate}`, bytes, firstByteMs: firstAudioMs, firstAudioMs, lastByteMs: closedMs, seconds },
        buffers,
        close: { graceful, closeSentMs, firstAudioMs, closedMs, code: e.code, beforeS: before / bytesPerSec, afterS: (bytes - before) / bytesPerSec, after, totals },
      })
    }, wait)
  }

  const stop = () => {
    stopped = true
    clearTimeout(timer)
    silence()
    ws.close()
    fail(new DOMException('Stopped', 'AbortError'))
  }

  return { done, stop }
}
