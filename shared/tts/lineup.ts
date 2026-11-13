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

  const one = async (voice: string): Promise<Uint8Array> => {
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
    const body = new Uint8Array(await res.arrayBuffer())
    bytes += body.byteLength
    return body
  }

  const done = (async (): Promise<LineupResult> => {
    const pending = voices.map(one)
    // Settle every request so one failure does not leave the others unhandled.
    pending.forEach((p) => p.catch(() => undefined))
    const rate = Number(params.sample_rate ?? 24000)
    const buffers: AudioBuffer[] = []
    let firstAudioMs = 0
    let at = ctx.currentTime + 0.05
    const gap = ctx.createBuffer(1, Math.round(rate * GAP_S), rate)
    for (let i = 0; i < voices.length; i++) {
      const raw = await pending[i]
      const samples = pcm16ToFloat(raw.byteLength % 2 ? raw.slice(0, -1) : raw)
      if (!samples.length) continue
      const buffer = ctx.createBuffer(1, samples.length, rate)
      buffer.copyToChannel(samples, 0)
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(out)
      at = Math.max(at, ctx.currentTime + 0.02)
      src.start(at)
      sources.push(src)
      if (!firstAudioMs) firstAudioMs = performance.now() - t0
      rows[i] = { voice: voices[i], seconds: buffer.duration, ...loudness(samples, rate) }
      const startsIn = (at - ctx.currentTime) * 1000
      timers.push(setTimeout(() => onUpdate([...rows], i), startsIn))
      onUpdate([...rows])
      at += buffer.duration
      buffers.push(buffer)
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
