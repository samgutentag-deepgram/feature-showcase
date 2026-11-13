// One text-to-speech request, played as the bytes arrive when the container allows it.
// The browser calls Deepgram directly with the 30-second token; the server only mints it.
import { fetchToken, toQuery } from '../common/config'
import type { Params } from '../common/feature'

// Flux voices are served only on /v2/speak (a 400 on /v1/speak); Aura-2 voices on /v1/speak.
// Checked live 2026-11-11, with a granted token too.
export const isFlux = (voice: string) => voice.startsWith('flux-')
export const speakPath = (voice: string) => (isFlux(voice) ? '/v2/speak' : '/v1/speak')
export const speakUrl = (voice: string) => `https://api.deepgram.com${speakPath(voice)}`

// "flux-cole-en" -> "cole", "aura-2-thalia-en" -> "thalia".
export const voiceName = (voice: string) => voice.replace(/^(flux|aura-2)-/, '').replace(/-[a-z]{2}$/, '')

export interface SpeakStats {
  contentType: string
  bytes: number
  // From the moment the request is sent. Token minting is not counted.
  firstByteMs: number
  firstAudioMs: number
  lastByteMs: number
  seconds: number
}

export interface Result {
  stats: SpeakStats
  // Every piece that played, in order, for Replay.
  buffers: AudioBuffer[]
}

export interface Playback {
  done: Promise<Result>
  stop(): void
}

// Plays buffers back to back through `out`. Returns a stop function.
export function replay(ctx: AudioContext, out: AudioNode, buffers: readonly AudioBuffer[]): () => void {
  let at = ctx.currentTime + 0.05
  const sources = buffers.map((b) => {
    const src = ctx.createBufferSource()
    src.buffer = b
    src.connect(out)
    src.start(at)
    at += b.duration
    return src
  })
  return () => sources.forEach((s) => {
    try {
      s.stop()
    } catch {
      // Already stopped.
    }
  })
}

// G.711 mu-law to linear, the decoder every phone system uses.
export function mulawToFloat(byte: number): number {
  const u = ~byte & 0xff
  const sign = u & 0x80
  const exponent = (u >> 4) & 0x07
  const mantissa = u & 0x0f
  const magnitude = (((mantissa << 3) + 0x84) << exponent) - 0x84
  return (sign ? -magnitude : magnitude) / 32768
}

export function pcm16ToFloat(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Float32Array(bytes.byteLength >> 1)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768
  return out
}

export function speakQuery(model: string, params: Params): string {
  return toQuery({ model, ...params }).toString()
}

// Sends the text, plays the audio through `out`, and resolves with timings once it has all arrived.
// onProgress gets the bytes received so far, after every chunk, so a page waiting for a file can
// show it arriving instead of sitting still.
export async function speak(
  ctx: AudioContext,
  out: AudioNode,
  model: string,
  params: Params,
  text: string,
  onProgress?: (bytes: number) => void,
): Promise<Playback> {
  const token = await fetchToken()
  const controller = new AbortController()
  const sources: AudioBufferSourceNode[] = []
  const stop = () => {
    controller.abort()
    for (const s of sources) {
      try {
        s.stop()
      } catch {
        // Already stopped.
      }
    }
  }

  const done = (async (): Promise<Result> => {
    const t0 = performance.now()
    let res: Response
    try {
      res = await fetch(`${speakUrl(model)}?${speakQuery(model, params)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
    } catch (err) {
      // Stopped before the response came (Stop, or a new pick): not a network problem.
      if ((err as Error).name === 'AbortError') throw err
      throw new Error('Could not reach Deepgram. Check your connection and try again.')
    }
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Deepgram could not speak that (${res.status}). ${detail.slice(0, 160)}`.trim())
    }
    const contentType = res.headers.get('content-type') ?? ''
    const rate = Number(params.sample_rate ?? 24000)
    const raw = params.container === 'none'
    const mulaw = params.encoding === 'mulaw'
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let bytes = 0
    let firstByteMs = 0
    let firstAudioMs = 0
    let carry: Uint8Array | null = null
    let next = 0

    const play = (samples: Float32Array<ArrayBuffer>, sampleRate: number) => {
      if (!samples.length) return
      const buffer = ctx.createBuffer(1, samples.length, sampleRate)
      buffer.copyToChannel(samples, 0)
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(out)
      next = Math.max(next, ctx.currentTime + 0.02)
      src.start(next)
      next += buffer.duration
      sources.push(src)
      if (!firstAudioMs) firstAudioMs = performance.now() - t0
    }

    for (;;) {
      const { done: end, value } = await reader.read()
      if (end) break
      if (!firstByteMs) firstByteMs = performance.now() - t0
      bytes += value.byteLength
      onProgress?.(bytes)
      if (!raw) {
        chunks.push(value)
        continue
      }
      if (mulaw) {
        play(Float32Array.from(value, mulawToFloat), rate)
      } else {
        // 16-bit samples can split across chunks; hold an odd byte for the next one.
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
        play(pcm16ToFloat(data), rate)
      }
    }
    const lastByteMs = performance.now() - t0

    if (!raw) {
      const all = new Uint8Array(bytes)
      let at = 0
      for (const c of chunks) {
        all.set(c, at)
        at += c.length
      }
      const audio = await ctx.decodeAudioData(all.buffer)
      play(new Float32Array(audio.getChannelData(0)), audio.sampleRate)
    }

    const buffers = sources.map((s) => s.buffer).filter((b): b is AudioBuffer => !!b)
    const seconds = buffers.reduce((sum, b) => sum + b.duration, 0)
    return { stats: { contentType, bytes, firstByteMs, firstAudioMs, lastByteMs, seconds }, buffers }
  })()

  return { done, stop }
}
