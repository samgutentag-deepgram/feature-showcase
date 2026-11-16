// A lineup: the same line in several voices, played back to back with a short gap, and each
// voice's loudness measured as it lands. Every voice is asked for at once (one granted token
// serves them all; five parallel POSTs on one token were a 200 each on 2026-11-13), and the audio
// queues in voice order, so the next voice is usually ready before the last one finishes.
// Raw 16-bit PCM only (encoding=linear16, container=none), so the samples can be measured as is.
import { fetchToken } from '../common/config'
import type { Params } from '../common/feature'
import { loudness, type Loudness } from './loudness'
import { pcm16ToFloat, speakQuery, speakUrl, type SpeakStats } from './speak'

const GAP_S = 0.4

// One voice's audio as it streams in: the fetch pushes chunks, the player reads them in order.
class Feed implements AsyncIterable<Uint8Array> {
  private chunks: Uint8Array[] = []
  private ended = false
  private error: unknown = null
  private wake: (() => void) | null = null
  push(c: Uint8Array) {
    this.chunks.push(c)
    this.wake?.()
  }
  end() {
    this.ended = true
    this.wake?.()
  }
  fail(err: unknown) {
    this.error = err
    this.wake?.()
  }
  async *[Symbol.asyncIterator]() {
    for (;;) {
      if (this.chunks.length) {
        yield this.chunks.shift()!
        continue
      }
      if (this.error) throw this.error
      if (this.ended) return
      await new Promise<void>((r) => (this.wake = r))
      this.wake = null
    }
  }
}

export interface LineupRow extends Partial<Loudness> {
  voice: string
  seconds?: number
}

export interface LineupResult {
  stats: SpeakStats
  buffers: AudioBuffer[]
  rows: LineupRow[]
}

export async function speakLineup(
  ctx: AudioContext,
  out: AudioNode,
  voices: string[],
  params: Params,
  text: string,
  // rows so far, and, when it changes, the index of the voice playing now (-1 once it is over).
  onUpdate: (rows: LineupRow[], playing?: number) => void,
): Promise<{ done: Promise<LineupResult>; stop(): void }> {
  if (params.encoding !== 'linear16' || params.container !== 'none') throw new Error('A lineup needs linear16 audio with container=none.')
  let token = await fetchToken()
  const controller = new AbortController()
  const sources: AudioBufferSourceNode[] = []
  const timers: ReturnType<typeof setTimeout>[] = []
  const rows: LineupRow[] = voices.map((voice) => ({ voice }))
  const stop = () => {
    controller.abort()
    timers.forEach(clearTimeout)
    // Nothing is playing any more, so no row stays marked.
    onUpdate([...rows], -1)
    for (const s of sources) {
      try {
        s.stop()
      } catch {
        // Already stopped.
      }
    }
  }

  const t0 = performance.now()
  let contentType = ''
  let firstByteMs = 0
  let bytes = 0

  const post = (voice: string, t: string) =>
    fetch(`${speakUrl(voice)}?${speakQuery(voice, params)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })

  const one = async (voice: string, feed: Feed): Promise<void> => {
    let res: Response
    try {
      res = await post(voice, token)
      // A token that will not stretch to every voice: get a fresh one and ask once more.
      if (res.status === 401) {
        token = await fetchToken()
        res = await post(voice, token)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      throw new Error('Could not reach Deepgram. Check your connection and try again.')
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Deepgram could not speak that in ${voice} (${res.status}). ${detail.slice(0, 160)}`.trim())
    }
    if (!firstByteMs) firstByteMs = performance.now() - t0
    contentType ||= res.headers.get('content-type') ?? ''
    const reader = res.body!.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      feed.push(value)
    }
    feed.end()
  }

  const done = (async (): Promise<LineupResult> => {
    const feeds = voices.map(() => new Feed())
    const pending = voices.map((v, i) => one(v, feeds[i]).catch((err) => feeds[i].fail(err)))
    void pending
    const rate = Number(params.sample_rate ?? 24000)
    const buffers: AudioBuffer[] = []
    let firstAudioMs = 0
    let at = ctx.currentTime + 0.05
    const gap = ctx.createBuffer(1, Math.round(rate * GAP_S), rate)
    for (let i = 0; i < voices.length; i++) {
      // Play each voice's audio as it arrives, chunk by chunk, so the first voice starts within a
      // moment of pressing Speak. The later voices are already downloading and wait their turn.
      const parts: Float32Array[] = []
      let carry: Uint8Array | null = null
      let started = false
      for await (const chunk of feeds[i]) {
        let bytes = chunk
        if (carry) {
          bytes = new Uint8Array(carry.byteLength + chunk.byteLength)
          bytes.set(carry)
          bytes.set(chunk, carry.byteLength)
          carry = null
        }
        if (bytes.byteLength % 2) {
          carry = bytes.slice(-1)
          bytes = bytes.slice(0, -1)
        }
        if (!bytes.byteLength) continue
        const samples = pcm16ToFloat(bytes)
        parts.push(samples)
        const buffer = ctx.createBuffer(1, samples.length, rate)
        buffer.copyToChannel(samples, 0)
        const src = ctx.createBufferSource()
        src.buffer = buffer
        src.connect(out)
        at = Math.max(at, ctx.currentTime + 0.02)
        if (!started) {
          started = true
          if (!firstAudioMs) firstAudioMs = performance.now() - t0
          timers.push(setTimeout(() => onUpdate([...rows], i), (at - ctx.currentTime) * 1000))
        }
        src.start(at)
        sources.push(src)
        at += buffer.duration
      }
      const total = parts.reduce((n, p) => n + p.length, 0)
      if (!total) continue
      const all = new Float32Array(total)
      let off = 0
      for (const p of parts) {
        all.set(p, off)
        off += p.length
      }
      const whole = ctx.createBuffer(1, all.length, rate)
      whole.copyToChannel(all, 0)
      rows[i] = { voice: voices[i], seconds: whole.duration, ...loudness(all, rate) }
      onUpdate([...rows])
      buffers.push(whole)
      if (i < voices.length - 1) {
        buffers.push(gap)
        at += GAP_S
      }
    }
    timers.push(setTimeout(() => onUpdate([...rows], -1), (at - ctx.currentTime) * 1000))
    const seconds = buffers.reduce((sum, b) => sum + b.duration, 0)
    return { stats: { contentType, bytes, firstByteMs, firstAudioMs, lastByteMs: performance.now() - t0, seconds }, buffers, rows }
  })()

  return { done, stop }
}

// The gap between the loudest and quietest voice's speech level, in dB.
export const spread = (rows: LineupRow[]) => {
  const levels = rows.map((r) => r.speechDb).filter((v): v is number => v !== undefined)
  return levels.length > 1 ? Math.max(...levels) - Math.min(...levels) : undefined
}
