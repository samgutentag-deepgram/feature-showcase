// AudioWorklet: mixes to mono, resamples to the target rate, posts 100 ms Int16 chunks.
class PcmEncoder extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const target = options.processorOptions.sampleRate
    this.step = sampleRate / target
    this.chunk = target / 10
    this.mix = new Float32Array(128)
    this.t = 0
    this.last = 0
    this.out = new Int16Array(this.chunk)
    this.n = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0 || input[0].length === 0) return true
    const len = input[0].length
    // Process runs every render quantum, so reuse one mix buffer instead of allocating.
    let mono = input[0]
    if (input.length > 1) {
      if (this.mix.length < len) this.mix = new Float32Array(len)
      mono = this.mix.subarray(0, len).fill(0)
      for (const ch of input) for (let i = 0; i < len; i++) mono[i] += ch[i] / input.length
    }

    // Linear interpolation between neighbors; index -1 is the previous block's last sample.
    while (Math.floor(this.t) + 1 < len) {
      const i = Math.floor(this.t)
      const a = i < 0 ? this.last : mono[i]
      const s = a + (mono[i + 1] - a) * (this.t - i)
      const c = Math.max(-1, Math.min(1, s))
      this.out[this.n++] = c < 0 ? c * 0x8000 : c * 0x7fff
      if (this.n === this.chunk) {
        this.port.postMessage(this.out.buffer, [this.out.buffer])
        this.out = new Int16Array(this.chunk)
        this.n = 0
      }
      this.t += this.step
    }
    this.t -= len
    this.last = mono[len - 1]
    return true
  }
}

registerProcessor('pcm-encoder', PcmEncoder)
