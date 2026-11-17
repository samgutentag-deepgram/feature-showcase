// The audio a speech-to-text page sends. Capture always yields 16 kHz linear16; a feature that
// streams another format (raw-audio-format) has it converted here, chunk by chunk, before it goes
// on the socket. Batch modes wrap the recording in a WAV header so the POST needs no format params.
import { SAMPLE_RATE } from '../common/config'
import type { Params } from '../common/feature'

export type Encoding = 'linear16' | 'mulaw' | 'alaw'
export const ENCODINGS: readonly Encoding[] = ['linear16', 'mulaw', 'alaw']
export const RATES = [8000, 16000] as const

export interface AudioFormat {
  encoding: Encoding
  sample_rate: (typeof RATES)[number]
}

export const PCM16K: AudioFormat = { encoding: 'linear16', sample_rate: SAMPLE_RATE as 16000 }

// What a request says it sends: its encoding and sample_rate params, linear16 at 16 kHz when unset.
export function declaredFormat(params: Params): AudioFormat {
  const encoding = String(params.encoding ?? 'linear16') as Encoding
  const sample_rate = Number(params.sample_rate ?? SAMPLE_RATE) as AudioFormat['sample_rate']
  return { encoding, sample_rate }
}

export function supported(f: AudioFormat): boolean {
  return ENCODINGS.includes(f.encoding) && (RATES as readonly number[]).includes(f.sample_rate)
}

// G.711 mu-law, from a 16-bit sample.
export function muLaw(sample: number): number {
  const BIAS = 0x84
  const sign = sample < 0 ? 0x80 : 0
  let s = Math.min(Math.abs(sample), 32635) + BIAS
  let exponent = 7
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--
  const mantissa = (s >> (exponent + 3)) & 0x0f
  return ~(sign | (exponent << 4) | mantissa) & 0xff
}

// G.711 A-law, from a 16-bit sample.
export function aLaw(sample: number): number {
  const sign = sample >= 0 ? 0x80 : 0
  let s = Math.min(Math.abs(sample), 32635)
  let out: number
  if (s >= 256) {
    let exponent = 7
    for (let mask = 0x4000; (s & mask) === 0 && exponent > 1; mask >>= 1) exponent--
    out = (exponent << 4) | ((s >> (exponent + 3)) & 0x0f)
  } else out = s >> 4
  return (out | sign) ^ 0x55
}

// 16 kHz linear16 in, the asked-for format out. 8 kHz averages each pair of samples, which is
// enough of a low-pass for speech.
export function transcode(pcm: ArrayBuffer, to: AudioFormat): ArrayBuffer {
  if (to.encoding === 'linear16' && to.sample_rate === SAMPLE_RATE) return pcm
  if (!supported(to)) throw new Error(`The page cannot send ${to.encoding} at ${to.sample_rate} Hz.`)
  const src = new Int16Array(pcm)
  const step = SAMPLE_RATE / to.sample_rate
  const n = Math.floor(src.length / step)
  const samples = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) sum += src[i * step + j]
    samples[i] = Math.round(sum / step)
  }
  if (to.encoding === 'linear16') return samples.buffer
  const out = new Uint8Array(n)
  const encode = to.encoding === 'mulaw' ? muLaw : aLaw
  for (let i = 0; i < n; i++) out[i] = encode(samples[i])
  return out.buffer
}

// A WAV file around 16-bit mono PCM chunks, for a batch POST of a mic recording.
export function wav(chunks: readonly ArrayBuffer[], rate = SAMPLE_RATE): Blob {
  const bytes = chunks.reduce((n, c) => n + c.byteLength, 0)
  const head = new DataView(new ArrayBuffer(44))
  const text = (at: number, s: string) => [...s].forEach((ch, i) => head.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  head.setUint32(4, 36 + bytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  head.setUint32(16, 16, true)
  head.setUint16(20, 1, true)
  head.setUint16(22, 1, true)
  head.setUint32(24, rate, true)
  head.setUint32(28, rate * 2, true)
  head.setUint16(32, 2, true)
  head.setUint16(34, 16, true)
  text(36, 'data')
  head.setUint32(40, bytes, true)
  return new Blob([head.buffer, ...chunks], { type: 'audio/wav' })
}
