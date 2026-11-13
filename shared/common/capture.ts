// Gets 16 kHz PCM out of the mic or an uploaded file. Uploads play aloud while they stream,
// so the transcript fills in at the same pace you hear it.
import workletUrl from './pcm-worklet.js?url'
import { SAMPLE_RATE } from './config'

export type Source = { kind: 'mic' } | { kind: 'file'; file: File }

export interface Capture {
  stop(): void
  // Present for uploads: the element that is playing.
  audio?: HTMLAudioElement
}

export async function startCapture(
  source: Source,
  onChunk: (pcm: ArrayBuffer) => void,
  onEnded: () => void,
): Promise<Capture> {
  const ctx = new AudioContext()
  const cleanups: Array<() => void> = [() => void ctx.close()]
  const stop = () => cleanups.splice(0).reverse().forEach((fn) => fn())

  try {
    await ctx.audioWorklet.addModule(workletUrl)
    const encoder = new AudioWorkletNode(ctx, 'pcm-encoder', {
      processorOptions: { sampleRate: SAMPLE_RATE },
    })
    encoder.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onChunk(e.data)
    // A silent sink keeps the encoder in the rendered graph.
    const sink = ctx.createGain()
    sink.gain.value = 0
    encoder.connect(sink).connect(ctx.destination)
    // The context is created after network awaits, so autoplay rules may have suspended it.
    await ctx.resume()

    if (source.kind === 'mic') {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      cleanups.push(() => stream.getTracks().forEach((t) => t.stop()))
      ctx.createMediaStreamSource(stream).connect(encoder)
      return { stop }
    }

    const url = URL.createObjectURL(source.file)
    const audio = new Audio(url)
    cleanups.push(() => {
      audio.pause()
      URL.revokeObjectURL(url)
    })
    audio.addEventListener('ended', onEnded, { once: true })
    const node = ctx.createMediaElementSource(audio)
    node.connect(encoder)
    node.connect(ctx.destination)
    await audio.play()
    return { stop, audio }
  } catch (err) {
    stop()
    throw err
  }
}

// Reads duration without playing, to reject long uploads before any audio is sent.
export function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This file is not audio the browser can play.'))
    }
    audio.src = url
  })
}
