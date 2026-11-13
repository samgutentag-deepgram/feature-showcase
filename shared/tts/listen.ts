// Hears the listener start talking, for a voice cut-in: the mic streams to Flux speech-to-text and
// every StartOfTurn calls onStart. This is the barge-in signal the Flux TTS docs describe.
// Verified live 2026-11-12: 1.5 s of silence, then "Wait, hold on, I need to change my address."
// streamed in real time to wss /v2/listen?model=flux-general-en (linear16, 16 kHz): StartOfTurn
// with transcript "Wait" about 500 ms after the speech began.
import { startCapture } from '../common/capture'
import { fetchToken, SAMPLE_RATE } from '../common/config'

export const LISTEN_URL = `wss://api.deepgram.com/v2/listen?model=flux-general-en&encoding=linear16&sample_rate=${SAMPLE_RATE}`

export interface Listener {
  stop(): void
}

export async function listenForTurn(onStart: (word: string) => void): Promise<Listener> {
  const token = await fetchToken()
  const ws = new WebSocket(LISTEN_URL, ['bearer', token])
  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') return
    const m = JSON.parse(e.data) as { type?: string; event?: string; transcript?: string }
    if (m.type === 'TurnInfo' && m.event === 'StartOfTurn') onStart(String(m.transcript ?? ''))
  }
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('Could not open the speech-to-text socket.'))
  })
  let capture: { stop(): void }
  try {
    capture = await startCapture({ kind: 'mic' }, (pcm) => ws.readyState === WebSocket.OPEN && ws.send(pcm), () => {})
  } catch (err) {
    ws.close()
    throw err
  }
  return {
    stop() {
      capture.stop()
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'CloseStream' }))
      ws.close()
    },
  }
}
