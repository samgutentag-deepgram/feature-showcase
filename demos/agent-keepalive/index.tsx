// KeepAlive: mute the mic without losing the call. Checked live 2026-11-16 on the Agent API, Settings
// applied, then no audio at all:
//   Nova-3 listen: Error CLIENT_MESSAGE_TIMEOUT ("We did not receive audio within our timeout...")
//                  12.0 s after the last thing sent, then the socket closed with no close code (1005).
//                  Same 12.0 s after a spoken turn, and 12.0 s after one lone KeepAlive.
//   Flux listen:   the same Error code ("Client did not send any messages within our timeout") after
//                  60.0 s, then 1005. No Warning came first on either model.
//   KeepAlive every 8 s held Nova-3 for 35 s and Flux for 75 s of no audio; the next spoken turn was
//   transcribed and answered on the same call. KeepAlive every 2 s held Nova-3 too. Nothing comes
//   back for a KeepAlive.
// So the page listens with Nova-3 only: Flux's 60 s limit is as long as this page's one-minute call,
// so the drop could never show here. KeepAlive holds both.
import { useEffect, useRef, useState } from 'react'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

interface State {
  repeat: boolean
}

const EVERY_MS = 8000
// Nova-3's limit for a socket with nothing sent, measured live.
const LIMIT_S = 12
const KEEPALIVE = { type: 'KeepAlive' }

interface Hold {
  secs: number
  repeat: boolean
  outcome: 'held' | 'closed' | 'stopped'
  error?: string
}

const secs = (s: number) => `${s.toFixed(1)} s`

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Put the caller on hold.',
    lede: 'Talk to the agent, then press Mute. The page stops sending audio and sends KeepAlive every 8 seconds instead, so the call stays open. Unmute after 20 seconds and pick up where you left off. Turn the repeat off and the call drops 12 seconds into the silence.',
    ctaTitle: 'Stop the audio, not the call.',
    ctaBody: (
      <>
        When your app stops streaming audio (mute, hold, a long pause), send <code>{'{"type":"KeepAlive"}'}</code> every
        8 seconds. Without it the agent closes the call: after 12 s with Nova-3 listening, 60 s with Flux. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/agent-keep-alive' },
  initialState: { repeat: true },
  variants: [{ repeat: true }, { repeat: false }],
  listenModels: [{ id: 'nova-3', label: 'Nova-3' }],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a support agent for Acme. The caller may put you on hold; when they come back, pick up where you left off. Keep answers to one short sentence.',
    },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: 'Hi, thanks for calling Acme. How can I help?',
  }),
  highlight: ['listen'],
  events: ['Error'],
  flushOnUserSpeech: () => true,
  // The Panel's Mute button fires these. Mute sends KeepAlive and stops the mic audio; with the
  // repeat on, the page sends it again every 8 s until Unmute.
  actions: ({ repeat }) => [
    { label: 'Mute', message: KEEPALIVE, ack: [], mic: 'off', ...(repeat ? { repeatMs: EVERY_MS } : {}), hidden: true },
    { label: 'Unmute', message: KEEPALIVE, ack: [], mic: 'on', hidden: true },
  ],
  runLabel: ({ repeat }) => (repeat ? 'KeepAlive every 8 s' : 'one KeepAlive, then nothing'),
  phrases: () => [
    'Hi, can you hold on a second while I grab my order number?',
    '(Press Mute, wait 20 seconds, then Unmute:)',
    "Okay, I'm back. The order number is four five six.",
  ],

  Controls({ state, setState, busy }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.repeat} disabled={busy} onChange={(e) => setState({ repeat: e.target.checked })} />
          Keep sending KeepAlive every 8 s while muted
        </label>
        <p className="note">
          Off, Mute sends one KeepAlive and then nothing. The agent listens with Nova-3, which closes a call after 12 s with
          nothing sent. Flux allows 60 s, as long as this page's one-minute call, so the drop would not show here; KeepAlive
          holds both.
        </p>
      </>
    )
  },

  Panel({ state, status, messages, fire }) {
    const live = status === 'live'
    const [mutedAt, setMutedAt] = useState<number | null>(null)
    const [now, setNow] = useState(0)
    const [holds, setHolds] = useState<Hold[]>([])
    const repeatRef = useRef(state.repeat)
    const error = messages.find((m) => m.msg.type === 'Error')

    // A new call starts clean.
    useEffect(() => {
      if (status === 'connecting') {
        setMutedAt(null)
        setHolds([])
      }
    }, [status])

    useEffect(() => {
      if (mutedAt === null) return
      setNow(performance.now())
      const t = window.setInterval(() => setNow(performance.now()), 200)
      return () => window.clearInterval(t)
    }, [mutedAt])

    // The call ended while muted: Deepgram closed it (an Error came first) or Stop was pressed.
    useEffect(() => {
      if (mutedAt === null || status === 'live') return
      const s = (performance.now() - mutedAt) / 1000
      const err = error ? `${String(error.msg.code ?? 'Error')}: ${String(error.msg.description ?? '')}` : undefined
      setHolds((all) => [...all, { secs: s, repeat: repeatRef.current, outcome: error ? 'closed' : 'stopped', error: err }])
      setMutedAt(null)
    }, [status, error, mutedAt])

    const mute = () => {
      repeatRef.current = state.repeat
      fire('Mute')
      setMutedAt(performance.now())
    }
    const unmute = () => {
      if (mutedAt !== null) setHolds((all) => [...all, { secs: (performance.now() - mutedAt) / 1000, repeat: repeatRef.current, outcome: 'held' }])
      fire('Unmute')
      setMutedAt(null)
    }

    const muted = mutedAt !== null ? Math.max(0, (now - mutedAt) / 1000) : 0
    // Time since the page last sent anything: KeepAlive goes out at Mute, then every 8 s if repeating.
    const quiet = mutedAt === null ? 0 : repeatRef.current ? muted % (EVERY_MS / 1000) : muted
    const fill = Math.min(1, quiet / LIMIT_S)

    return (
      <div className="ka">
        <div className="ka__row">
          {mutedAt === null ? (
            <button className="btn btn--primary" disabled={!live} onClick={mute}>
              Mute
            </button>
          ) : (
            <button className="btn btn--primary" disabled={!live} onClick={unmute}>
              Unmute
            </button>
          )}
          <span className="ka__state" role="status" aria-live="polite">
            {!live && mutedAt === null
              ? 'Start a call, say something, then press Mute.'
              : mutedAt === null
                ? 'Mic audio is streaming.'
                : `Muted ${secs(muted)}: no audio is sent. ${repeatRef.current ? 'KeepAlive every 8 s.' : 'One KeepAlive at Mute, then nothing.'}`}
          </span>
        </div>
        <div className="ka__meter" aria-label="Time since the page last sent anything">
          <div className={`ka__fill${fill >= 1 ? ' is-over' : ''}`} style={{ width: `${fill * 100}%` }} />
          <span className="ka__mark">Nova-3 closes at {LIMIT_S} s with nothing sent</span>
        </div>
        <p className="note ka__quiet">
          Since the last message sent: <strong>{secs(quiet)}</strong>
        </p>
        {holds.length > 0 && (
          <ol className="ka__holds" aria-label="Holds this call">
            {holds.map((h, i) => (
              <li key={i} className={`ka__hold ka__hold--${h.outcome}`}>
                Muted {secs(h.secs)}, {h.repeat ? 'KeepAlive every 8 s' : 'one KeepAlive'}:{' '}
                {h.outcome === 'held'
                  ? 'the call stayed open. Keep talking: the agent remembers the call.'
                  : h.outcome === 'closed'
                    ? `Deepgram closed the call. ${h.error ?? ''}`
                    : 'you stopped the call.'}
              </li>
            ))}
          </ol>
        )}
      </div>
    )
  },
})
