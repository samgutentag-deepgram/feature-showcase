// A reply arriving like LLM output, spoken on one Flux socket (wss /v2/speak). The page drips the
// reply out a token at a time (a word and its space, every tokenMs) and sends it one of three ways:
//   whole:  wait for the whole reply, then Speak it and Flush, the way most code starts out.
//   stream: Speak each token as it arrives, Flush right after the last one.
//   late:   Speak each token as it arrives, but Flush LATE_MS after the last one.
// Verified live 2026-11-12, flux-wes-en, linear16 at 24 kHz, a 3-sentence reply:
//   whole                 first audio 153 ms after the text was sent; nothing before Flush
//   stream, 60 ms/token   first audio 467 ms after the first token, 2.15 s of 8.16 s before Flush
//   stream, 120 ms/token  first audio 767 ms, 4.55 s of 8.64 s before Flush
//   late (Flush +3 s)     4.87 s of 8.72 s came before Flush; the last 3.85 s waited for it
// So Flux starts speaking a turn before the text is complete, but holds the tail until Flush.
import { fetchToken } from '../common/config'
import type { Params } from '../common/feature'
import { mulawToFloat, pcm16ToFloat, speakPath, speakQuery } from './speak'

export type TokenMode = 'whole' | 'stream' | 'late'
export const LATE_MS = 3000

export interface TokenStats {
  mode: TokenMode
  // All times from the first token.
  textDoneMs: number
  flushMs: number
  firstAudioMs: number
  // Audio that had arrived when Flush went out, and in all.
  beforeFlushS: number
  totalS: number
  doneMs: number
}

export interface TokenResult {
  buffers: AudioBuffer[]
  stats: TokenStats
}

export interface TokenPlayback {
  done: Promise<TokenResult>
  stop(): void
}

export const tokenize = (text: string) => text.match(/\S+\s*/g) ?? [text]

export function tokenUrl(voice: string, params: Params) {
  const query = Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'container'))
  return `wss://api.deepgram.com${speakPath(voice)}?${speakQuery(voice, query)}`
}

export async function speakTokens(
  ctx: AudioContext,
  out: AudioNode,
  voice: string,
  params: Params,
  text: string,
  mode: TokenMode,
  tokenMs: number,
  onText: (shown: string) => void,
): Promise<TokenPlayback> {
  const token = await fetchToken()
  const rate = Number(params.sample_rate ?? 24000)
  const mulaw = params.encoding === 'mulaw'
  const bytesPerSec = rate * (mulaw ? 1 : 2)
  const ws = new WebSocket(tokenUrl(voice, params), ['bearer', token])
  ws.binaryType = 'arraybuffer'
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('Could not open the Deepgram socket. Check your connection and try again.'))
  })

  let stopped = false
  let next = 0
  let bytes = 0
  let carry: Uint8Array | null = null
  let t0 = 0
  let firstAudioMs = 0
  let flushMs = 0
  let beforeFlush = 0
  const played: AudioBufferSourceNode[] = []
  let ended: () => void = () => {}
  let fail: (e: Error) => void = () => {}
  const turnEnd = new Promise<void>((resolve, reject) => {
    ended = resolve
    fail = reject
  })
  turnEnd.catch(() => {})

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

  ws.onclose = (e) => {
    if (!stopped && e.code !== 1000 && e.code !== 1005) fail(new Error(`Deepgram closed the socket (${e.code}). ${e.reason}`.trim()))
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
    if (m.type === 'Error') fail(new Error(`Deepgram: ${String(m.description ?? m.code ?? 'error')}`))
    if (m.type === 'SpeechMetadata') ended()
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

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const flush = () => {
    flushMs = performance.now() - t0
    beforeFlush = bytes
    ws.send(JSON.stringify({ type: 'Flush' }))
  }

  const done = (async (): Promise<TokenResult> => {
    try {
      const tokens = tokenize(text)
      t0 = performance.now()
      let shown = ''
      for (const tok of tokens) {
        if (stopped) throw new DOMException('Stopped', 'AbortError')
        shown += tok
        onText(shown)
        if (mode !== 'whole') ws.send(JSON.stringify({ type: 'Speak', text: tok }))
        await wait(tokenMs)
      }
      const textDoneMs = performance.now() - t0
      if (mode === 'whole') ws.send(JSON.stringify({ type: 'Speak', text }))
      if (mode === 'late') await wait(LATE_MS)
      if (stopped) throw new DOMException('Stopped', 'AbortError')
      flush()
      await turnEnd
      const doneMs = performance.now() - t0
      await wait(Math.max(next - ctx.currentTime, 0) * 1000 + 50)
      if (stopped) throw new DOMException('Stopped', 'AbortError')
      ws.close()
      const buffers = played.map((s) => s.buffer).filter((b): b is AudioBuffer => !!b)
      return {
        buffers,
        stats: { mode, textDoneMs, flushMs, firstAudioMs, beforeFlushS: beforeFlush / bytesPerSec, totalS: bytes / bytesPerSec, doneMs },
      }
    } catch (err) {
      ws.close()
      throw err
    }
  })()

  return { done, stop }
}
