// One line spoken over the text-to-speech WebSocket, with a cut-in partway through.
// The browser opens the socket itself with the 30-second token; the server only mints it.
// Verified live 2026-11-12, wes on /v2/speak and thalia on /v1/speak, linear16 at 24 kHz, a
// 211-character line cut 1.5 s in, then "Sure, go ahead." sent on the same socket:
//   /v2 Interrupt + playback_offset  SpeechInterrupted in 38-97 ms with text_spoken and
//                                    text_remaining; reply audio 235-272 ms after the cut
//   /v2 no Interrupt                 reply audio 7256 ms after the cut, behind 9.4 s of the old line
//   /v1 Clear                        Cleared in 19-21 ms; reply audio 90 ms after the cut
//   /v1 no Clear                     reply audio 4675 ms after the cut, behind 9.8 s of the old line
// A few frames (0.04-0.08 s) arrive between the cut and the ack; they are dropped, never played.
// Interrupt or Clear after the line has finished is harmless: the ack still comes.
import { fetchToken } from '../common/config'
import type { Params } from '../common/feature'
import { isFlux, mulawToFloat, pcm16ToFloat, speakPath, speakQuery, type Playback, type Result } from './speak'

export const socketUrl = (voice: string, params: Params) => `wss://api.deepgram.com${speakPath(voice)}?${speakQuery(voice, params)}`

// What the page sends when the listener cuts in. playback_offset is how much audio has played,
// counted from the start of the session; Flux uses it to split the line into heard and not heard.
export const cutMessage = (voice: string, heardMs: number) =>
  isFlux(voice) ? { type: 'Interrupt', playback_offset: { type: 'time_ms', value: Math.round(heardMs) } } : { type: 'Clear' }

export interface CutStats {
  // Audio the listener actually heard before the cut.
  heardMs: number
  // Audio that had arrived by then, heard or still queued.
  receivedMs: number
  // The message sent, or null when the page only stopped playing.
  sent: object | null
  // The server's answer to it: SpeechInterrupted or Cleared, as received.
  ack?: Record<string, unknown>
  ackMs?: number
  // From the cut to the first sample of the reply.
  replyFirstAudioMs?: number
  // Old-line audio that arrived after the cut and was thrown away.
  droppedMs: number
}

export interface SocketPlayback extends Playback {
  done: Promise<Result & { cut?: CutStats }>
  // Stops playback now, tells Deepgram (if `interrupt`), and speaks `reply` on the same socket.
  cut(reply: string, interrupt: boolean): void
}

export async function speakSocket(ctx: AudioContext, out: AudioNode, voice: string, params: Params, text: string): Promise<SocketPlayback> {
  const token = await fetchToken()
  const flux = isFlux(voice)
  const rate = Number(params.sample_rate ?? 24000)
  const mulaw = params.encoding === 'mulaw'
  const bytesPerSec = rate * (mulaw ? 1 : 2)
  const ws = new WebSocket(socketUrl(voice, params), ['bearer', token])
  ws.binaryType = 'arraybuffer'

  // 'line' plays the first line; 'drop' throws away what is left of it; 'reply' plays the answer.
  let phase: 'line' | 'drop' | 'reply' = 'line'
  let lineDone = false
  let replyDone = false
  let t0 = 0
  let cutAt = 0
  let bytes = 0
  let firstByteMs = 0
  let firstAudioMs = 0
  let lastByteMs = 0
  let next = 0
  let carry: Uint8Array | null = null
  let cut: CutStats | undefined
  const played: { src: AudioBufferSourceNode; at: number; duration: number }[] = []

  let finish: (r: Result & { cut?: CutStats }) => void = () => {}
  let fail: (e: Error) => void = () => {}
  const done = new Promise<Result & { cut?: CutStats }>((res, rej) => {
    finish = res
    fail = rej
  })

  const heardMs = () => played.reduce((sum, p) => sum + Math.min(Math.max(ctx.currentTime - p.at, 0), p.duration), 0) * 1000
  const silence = () =>
    played.forEach((p) => {
      try {
        p.src.stop()
      } catch {
        // Already stopped.
      }
    })

  const play = (samples: Float32Array<ArrayBuffer>) => {
    if (!samples.length) return
    const buffer = ctx.createBuffer(1, samples.length, rate)
    buffer.copyToChannel(samples, 0)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(out)
    next = Math.max(next, ctx.currentTime + 0.02)
    src.start(next)
    played.push({ src, at: next, duration: buffer.duration })
    next += buffer.duration
    if (!firstAudioMs) firstAudioMs = performance.now() - t0
    if (phase === 'reply' && cut && cut.replyFirstAudioMs === undefined) cut.replyFirstAudioMs = performance.now() - cutAt
  }

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

  // Resolves once the last thing asked for has arrived and finished playing.
  const settle = () => {
    if (!(cut ? replyDone : lineDone)) return
    const wait = Math.max(next - ctx.currentTime, 0) * 1000 + 50
    setTimeout(() => {
      // A cut-in while the line's tail was still playing: the reply settles instead.
      if (!(cut ? replyDone : lineDone)) return
      ws.close()
      const buffers = played.map((p) => p.src.buffer).filter((b): b is AudioBuffer => !!b)
      const seconds = played.reduce((s, p) => s + p.duration, 0)
      finish({ stats: { contentType: mulaw ? `audio/mulaw;rate=${rate}` : `audio/l16;rate=${rate}`, bytes, firstByteMs, firstAudioMs, lastByteMs, seconds }, buffers, cut })
    }, wait)
  }

  ws.onopen = () => {
    t0 = performance.now()
    ws.send(JSON.stringify({ type: 'Speak', text }))
    ws.send(JSON.stringify({ type: 'Flush' }))
  }
  ws.onerror = () => fail(new Error('Could not open the Deepgram socket. Check your connection and try again.'))
  ws.onclose = (e) => {
    if (e.code !== 1000 && e.code !== 1005 && !(cut ? replyDone : lineDone)) fail(new Error(`Deepgram closed the socket (${e.code}). ${e.reason}`.trim()))
  }
  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') {
      const value = new Uint8Array(e.data as ArrayBuffer)
      if (!firstByteMs) firstByteMs = performance.now() - t0
      lastByteMs = performance.now() - t0
      bytes += value.byteLength
      if (phase === 'drop') {
        if (cut) cut.droppedMs += (value.byteLength / bytesPerSec) * 1000
        return
      }
      play(decode(value))
      return
    }
    const m = JSON.parse(e.data) as Record<string, unknown>
    if (m.type === 'Error') {
      fail(new Error(`Deepgram: ${String(m.description ?? m.err_msg ?? m.code ?? 'error')}`))
      ws.close()
      return
    }
    if (m.type === 'SpeechInterrupted' || m.type === 'Cleared') {
      if (cut) {
        cut.ack = m
        cut.ackMs = performance.now() - cutAt
      }
      // The interrupted Flux turn ends here, with no SpeechMetadata of its own.
      if (m.type === 'SpeechInterrupted') lineDone = true
      // Aura-2 marks the end of the old line with Cleared; Flux with the reply's SpeechStarted.
      if (m.type === 'Cleared' && phase === 'drop') phase = 'reply'
      return
    }
    if (m.type === 'SpeechStarted' && phase === 'drop' && cut && lineDone) phase = 'reply'
    // Flux: SpeechMetadata ends a turn. Aura-2: Flushed does.
    // Aura-2 numbers its flushes: 0 is the line, so a late Flushed 0 never ends the reply.
    const turnEnd = flux ? m.type === 'SpeechMetadata' : m.type === 'Flushed' && !(phase === 'reply' && m.sequence_id === 0)
    if (turnEnd) {
      if (phase === 'line') lineDone = true
      else if (phase === 'drop') {
        lineDone = true
        if (!flux) phase = 'reply'
      } else replyDone = true
      settle()
    }
  }

  const stop = () => {
    silence()
    ws.close()
    fail(new DOMException('Stopped', 'AbortError'))
  }

  const cutIn = (reply: string, interrupt: boolean) => {
    if (cut || ws.readyState !== WebSocket.OPEN) return
    cutAt = performance.now()
    const heard = heardMs()
    silence()
    // Keep only what was heard, so Replay plays the run as the listener got it.
    const unheard = played.findIndex((p) => p.at > ctx.currentTime)
    if (unheard >= 0) played.splice(unheard)
    next = 0
    carry = null
    const sent = interrupt ? cutMessage(voice, heard) : null
    cut = { heardMs: heard, receivedMs: (bytes / bytesPerSec) * 1000, sent, droppedMs: 0 }
    // Nothing left of the old line to drop if it already finished arriving.
    phase = lineDone ? 'reply' : 'drop'
    if (sent) ws.send(JSON.stringify(sent))
    ws.send(JSON.stringify({ type: 'Speak', text: reply }))
    ws.send(JSON.stringify({ type: 'Flush' }))
  }

  return { done, stop, cut: cutIn }
}
