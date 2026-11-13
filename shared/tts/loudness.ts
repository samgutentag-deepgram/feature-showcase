// How loud a clip is, measured the way tts-normalize-volume was checked against the API: the peak
// sample, and the RMS of the speech only (20 ms windows above -50 dBFS), so pauses and trailing
// silence do not drag a voice's level down. Both in dBFS, 0 being full scale.
export interface Loudness {
  peakDb: number
  speechDb: number
}

const SILENCE_DB = -50
const toDb = (v: number) => (v > 0 ? 20 * Math.log10(v) : -99)

export function loudness(samples: Float32Array, sampleRate: number): Loudness {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  const w = Math.max(1, Math.round(sampleRate * 0.02))
  let sum = 0
  let n = 0
  for (let i = 0; i + w <= samples.length; i += w) {
    let e = 0
    for (let j = i; j < i + w; j++) e += samples[j] * samples[j]
    e /= w
    if (e > 0 && 10 * Math.log10(e) > SILENCE_DB) {
      sum += e
      n++
    }
  }
  return { peakDb: toDb(peak), speechDb: n ? toDb(Math.sqrt(sum / n)) : -99 }
}
