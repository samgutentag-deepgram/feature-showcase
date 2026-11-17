// G.711 for agent demos that run phone audio (audio.input / audio.output mulaw or alaw, 8 kHz).
// The mic arrives as 16 kHz linear16; these turn it into what the Settings message promised, and
// turn the agent's audio back into samples the page can play.
import type { AgentAudio, AgentEncoding } from './feature'

const BIAS = 0x84
const CLIP = 32635

export function linearToMulaw(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0
  const s = Math.min(Math.abs(sample), CLIP) + BIAS
  let exp = 7
  for (let mask = 0x4000; (s & mask) === 0 && exp > 0; mask >>= 1) exp--
  const mantissa = (s >> (exp + 3)) & 0x0f
  return ~(sign | (exp << 4) | mantissa) & 0xff
}

export function mulawToLinear(byte: number): number {
  const u = ~byte & 0xff
  const exp = (u >> 4) & 0x07
  const s = ((((u & 0x0f) << 3) + BIAS) << exp) - BIAS
  return u & 0x80 ? -s : s
}

const ALAW_END = [0x1f, 0x3f, 0x7f, 0xff, 0x1ff, 0x3ff, 0x7ff, 0xfff]

export function linearToAlaw(sample: number): number {
  let pcm = sample >> 3
  let mask = 0xd5
  if (pcm < 0) {
    mask = 0x55
    pcm = -pcm - 1
  }
  const seg = ALAW_END.findIndex((end) => pcm <= end)
  if (seg < 0) return 0x7f ^ mask
  const aval = (seg << 4) | ((seg < 2 ? pcm >> 1 : pcm >> seg) & 0x0f)
  return aval ^ mask
}

export function alawToLinear(byte: number): number {
  const a = byte ^ 0x55
  const exp = (a >> 4) & 0x07
  let s = ((a & 0x0f) << 4) + 8
  if (exp) s = (s + 0x100) << (exp - 1)
  return a & 0x80 ? s : -s
}

// 16 kHz linear16 from the mic into the Settings input format. 8 kHz averages each pair of samples,
// a cheap low-pass before dropping every other one.
export function encodeMic(pcm: ArrayBuffer, input: AgentAudio['input']): ArrayBuffer {
  if (input.encoding === 'linear16' && input.sample_rate === 16000) return pcm
  let samples = new Int16Array(pcm)
  if (input.sample_rate === 8000) {
    const half = new Int16Array(samples.length >> 1)
    for (let i = 0; i < half.length; i++) half[i] = (samples[2 * i] + samples[2 * i + 1]) >> 1
    samples = half
  }
  if (input.encoding === 'linear16') return samples.buffer as ArrayBuffer
  const encode = input.encoding === 'mulaw' ? linearToMulaw : linearToAlaw
  return Uint8Array.from(samples, encode).buffer as ArrayBuffer
}

// Agent audio bytes into float samples at the output sample rate.
export function decodeAgent(bytes: Uint8Array, encoding: AgentEncoding): Float32Array<ArrayBuffer> {
  if (encoding === 'mulaw') return Float32Array.from(bytes, (b) => mulawToLinear(b) / 32768)
  if (encoding === 'alaw') return Float32Array.from(bytes, (b) => alawToLinear(b) / 32768)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Float32Array(bytes.byteLength >> 1)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(2 * i, true) / 32768
  return out
}
