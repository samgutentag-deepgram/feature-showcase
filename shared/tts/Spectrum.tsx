// Live frequency bars for whatever is playing, 0 to 12 kHz. With phoneMark, a line at 4 kHz: the top
// of a phone line (8 kHz sampling). Colors come from the theme tokens.
import { useEffect, useRef } from 'react'

const TOP_HZ = 12_000
const MARK_HZ = 4_000

export function Spectrum({ analyser, phoneMark = false }: { analyser: AnalyserNode | null; phoneMark?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c || !analyser) return
    const g = c.getContext('2d')
    if (!g) return
    const css = getComputedStyle(document.documentElement)
    const bar = css.getPropertyValue('--dg-accent').trim()
    const mark = css.getPropertyValue('--dg-text-label').trim()
    const bins = new Uint8Array(analyser.frequencyBinCount)
    const hzPerBin = analyser.context.sampleRate / 2 / bins.length
    const shown = Math.floor(TOP_HZ / hzPerBin)
    let frame = 0

    const draw = () => {
      const w = (c.width = c.clientWidth * devicePixelRatio)
      const h = (c.height = c.clientHeight * devicePixelRatio)
      analyser.getByteFrequencyData(bins)
      g.clearRect(0, 0, w, h)
      g.fillStyle = bar
      const bw = w / shown
      for (let i = 0; i < shown; i++) {
        const v = bins[i] / 255
        g.fillRect(i * bw, h - v * h, Math.max(1, bw - 1), v * h)
      }
      if (phoneMark) {
        g.fillStyle = mark
        g.fillRect((MARK_HZ / TOP_HZ) * w, 0, Math.max(1, devicePixelRatio), h)
      }
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [analyser, phoneMark])

  return (
    <figure className="spectrum">
      <canvas ref={canvas} aria-label="Live frequency bars of the audio playing" />
      <figcaption>
        <span>0 Hz</span>
        {phoneMark && <span className="spectrum__mark">4 kHz: a phone line stops here</span>}
        <span>12 kHz</span>
      </figcaption>
    </figure>
  )
}
