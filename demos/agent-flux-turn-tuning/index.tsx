// Flux turn tuning: eot_threshold and eot_timeout_ms on the voice agent's Flux listen provider decide
// how long the agent waits after you stop before it replies. Checked live 2026-11-16 on the Agent API
// with flux-general-en, gpt-4o-mini and flux-wes-en, streaming a macOS `say` clip at real time:
// "So I would like to order", 2.1 s of silence, then "two large pizzas for pickup." Times are from the
// end of the last word before each EndOfTurn to the agent's first audio:
//   Patient (eot_threshold 0.9, eot_timeout_ms 8000): one user line with the whole sentence,
//   EndOfTurn {"trigger":"model"}, agent audio 2.8 s after "pickup". It never cut in during the pause.
//   Snappy (eot_threshold 0.5, eot_timeout_ms 1000): it cut in during the pause. "So I would like to
//   order." ended on EndOfTurn {"trigger":"timeout"} and the agent's audio started 1.6 s after "order";
//   then "Two large pizzas for pickup." got its own EndOfTurn {"trigger":"model"}, reply 1.2 s later.
//   eot_threshold 0.5 alone (default timeout) also cut in, at 1.6 s, with trigger "model"; 0.9 alone
//   matched Patient. The default (0.7, 5000) cut in at 2.0 s, just before the second half.
// EndOfTurn carries only trigger, and ConversationText has no word times, so the panel times "you
// stopped" from the mic level on this page, ignoring frames while the agent's audio plays.
import { useEffect, useRef, useState } from 'react'
import { defineAgentFeature, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

type Preset = 'patient' | 'snappy'

interface State {
  preset: Preset
}

export const PRESETS: Record<Preset, { label: string; eot_threshold: number; eot_timeout_ms: number; blurb: string }> = {
  patient: { label: 'Patient', eot_threshold: 0.9, eot_timeout_ms: 8000, blurb: 'Waits until it is sure you are done. Pauses up to 8 s do not end the turn.' },
  snappy: { label: 'Snappy', eot_threshold: 0.5, eot_timeout_ms: 1000, blurb: 'Replies on a hunch, and any second of silence ends the turn.' },
}

const PRESET_IDS = Object.keys(PRESETS) as Preset[]

// Mic RMS above this counts as you talking. noiseSuppression is on, so room noise sits well below it.
const VOICE_RMS = 0.015
const FRAME_MS = 50

// Times (ms since Start) when the mic was loud, as [start, end] spans. Frames while the agent's
// audio plays are skipped, so its voice through your speakers is not counted as yours.
function useVoiceSpans(status: AgentPanelProps<State>['status'], playing: boolean): { spans: Array<[number, number]>; ok: boolean } {
  const [spans, setSpans] = useState<Array<[number, number]>>([])
  const [ok, setOk] = useState(false)
  const t0 = useRef(0)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const listening = status === 'connecting' || status === 'live'

  useEffect(() => {
    if (status === 'mic') {
      t0.current = performance.now()
      setSpans([])
      setOk(false)
    }
  }, [status])

  useEffect(() => {
    if (!listening) return
    let stopped = false
    let cleanup = () => {}
    ;(async () => {
      try {
        // The shell already holds the mic by now, so this does not prompt again.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(analyser)
        await ctx.resume()
        const buf = new Float32Array(analyser.fftSize)
        let open: [number, number] | null = null
        const id = window.setInterval(() => {
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += v * v
          const loud = Math.sqrt(sum / buf.length) > VOICE_RMS && !playingRef.current
          const at = performance.now() - t0.current
          if (loud) {
            if (open && at - open[1] <= FRAME_MS * 3) open[1] = at
            else {
              open = [at, at]
              const span = open
              setSpans((all) => [...all, span])
              return
            }
            const span: [number, number] = [open[0], open[1]]
            setSpans((all) => [...all.slice(0, -1), span])
          }
        }, FRAME_MS)
        setOk(true)
        cleanup = () => {
          window.clearInterval(id)
          stream.getTracks().forEach((t) => t.stop())
          void ctx.close()
        }
      } catch {
        // No level meter: the panel falls back to timing from EndOfTurn.
        setOk(false)
      }
    })()
    return () => {
      stopped = true
      cleanup()
    }
  }, [listening])

  return { spans, ok }
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export interface Turn {
  user: string
  trigger: string
  // ms since Start.
  eot: number
  voice?: number
  // You started talking again before the agent's reply finished.
  talkedOver: boolean
}

// One turn per EndOfTurn: the user lines that came with it, its trigger, the agent's first audio
// after it, and whether UserStartedSpeaking arrived before that reply's AgentAudioDone.
export function turnsOf(messages: AgentPanelProps<State>['messages'], audioStarts: number[]): Turn[] {
  const turns: Turn[] = []
  let lines: string[] = []
  let firstLine = Infinity
  for (const { ms, msg } of messages) {
    if (msg.type === 'ConversationText' && msg.role === 'user') {
      lines.push(String(msg.content))
      firstLine = Math.min(firstLine, ms)
    }
    if (msg.type !== 'EndOfTurn') continue
    const from = Math.min(firstLine, ms)
    turns.push({ user: lines.join(' '), trigger: String(msg.trigger ?? ''), eot: ms, voice: audioStarts.find((a) => a >= from - 50), talkedOver: false })
    lines = []
    firstLine = Infinity
  }
  for (const t of turns) {
    if (t.voice === undefined) continue
    const done = messages.find((m) => m.ms > t.voice! && m.msg.type === 'AgentAudioDone')?.ms ?? Infinity
    t.talkedOver = messages.some((m) => m.msg.type === 'UserStartedSpeaking' && m.ms > t.voice! && m.ms <= done)
  }
  return turns
}

function TurnPanel({ state, status, messages, playing, audioStarts }: AgentPanelProps<State>) {
  const { spans, ok } = useVoiceSpans(status, playing)
  const turns = turnsOf(messages, audioStarts)
  const p = PRESETS[state.preset]
  if (!turns.length)
    return (
      <div className="ftt">
        <span className="ftt__label">Each EndOfTurn, and how long the agent waited</span>
        <p className="hint">{status === 'idle' ? 'Start talking. Each turn lands here once Flux ends it.' : 'Say the line, pause in the middle, and finish it.'}</p>
      </div>
    )
  // The last time you were loud before each EndOfTurn: the end of your last word.
  const stopped = turns.map((t, i) => {
    const after = i ? turns[i - 1].eot : -Infinity
    const ends = spans.filter(([s, e]) => s > after && e <= t.eot).map(([, e]) => e)
    return ok && ends.length ? Math.max(...ends) : undefined
  })
  const scale = Math.max(3000, ...turns.map((t, i) => (t.voice ?? t.eot) - (stopped[i] ?? t.eot)))
  const pct = (ms: number) => `${Math.min(100, Math.max(0, (ms / scale) * 100))}%`
  return (
    <div className="ftt" aria-live="polite">
      <span className="ftt__label">
        Each EndOfTurn on {p.label}: eot_threshold {p.eot_threshold}, eot_timeout_ms {p.eot_timeout_ms}
      </span>
      <ol>
        {turns.map((t, i) => {
          const from = stopped[i]
          const wait = t.voice !== undefined && from !== undefined ? t.voice - from : undefined
          return (
            <li key={i}>
              <span className="ftt__at">{secs(t.eot)}</span>
              <span className="ftt__line">{t.user || '(no transcript)'}</span>
              <span className="ftt__facts">
                <mark className={`ftt__trigger ftt__trigger--${t.trigger}`}>trigger: {t.trigger || 'none'}</mark>
                {' · '}
                {wait !== undefined
                  ? `agent spoke ${secs(wait)} after your last word`
                  : t.voice !== undefined
                    ? `agent spoke ${secs(t.voice - t.eot)} after EndOfTurn`
                    : 'no reply yet'}
                {t.talkedOver ? ' · you were still talking: it cut in' : ''}
              </span>
              {from !== undefined && (
                <span className="ftt__bar" aria-hidden="true">
                  <span className="ftt__mark ftt__mark--you" style={{ left: 0 }} title="your last word" />
                  <span className="ftt__mark ftt__mark--eot" style={{ left: pct(t.eot - from) }} title="EndOfTurn" />
                  {t.voice !== undefined && <span className="ftt__mark ftt__mark--voice" style={{ left: pct(t.voice - from) }} title="agent voice" />}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <p className="hint">
        <span className="ftt__key ftt__key--you" /> your last word <span className="ftt__key ftt__key--eot" /> EndOfTurn{' '}
        <span className="ftt__key ftt__key--voice" /> agent voice.{' '}
        {ok ? 'Your last word is timed from the mic level on this page.' : 'No mic level here, so waits are timed from EndOfTurn.'}
      </p>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Should your agent wait, or jump in?',
    lede: 'Flux decides when you are done talking. Two numbers on the listen provider tune it: eot_threshold, how sure Flux must be, and eot_timeout_ms, how much silence ends the turn anyway. Pick Patient or Snappy, say a line with a pause in the middle, and watch whether the agent waits for the rest.',
    ctaTitle: 'Tune turn-taking to your callers.',
    ctaBody: (
      <>
        Set <code>eot_threshold</code> and <code>eot_timeout_ms</code> on <code>agent.listen.provider</code> with a Flux model.
        Raise them for callers who pause to think, lower them for quick back and forth. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux/agent' },
  initialState: { preset: 'patient' },
  variants: PRESET_IDS.map((preset) => ({ preset })),
  listenModels: [{ id: 'flux-general-en', label: 'Flux' }],
  listen: ({ preset }) => ({ version: 'v2', eot_threshold: PRESETS[preset].eot_threshold, eot_timeout_ms: PRESETS[preset].eot_timeout_ms }),
  agent: () => ({
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You take phone orders for Acme Pizza. Keep answers to one short sentence.',
    },
    speak: { provider: { type: 'deepgram', model: 'flux-wes-en' } },
    greeting: 'Acme Pizza, what can I get you?',
  }),
  highlight: ['eot_threshold', 'eot_timeout_ms'],
  events: ['EndOfTurn', 'UserStartedSpeaking'],
  flushOnUserSpeech: () => true,
  runLabel: ({ preset }) => PRESETS[preset].label,
  phrases: () => ['After the greeting, say this with a real pause, two seconds or so, at the dots:', 'So I would like to order ... two large pizzas for pickup.', 'Then switch setting and say it again.'],

  Controls({ state, setState, busy }) {
    return (
      <div className="ftt-controls">
        <div className="segmented" role="radiogroup" aria-label="Turn-taking">
          {PRESET_IDS.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={state.preset === id}
              className={state.preset === id ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ preset: id })}
            >
              {PRESETS[id].label}
            </button>
          ))}
        </div>
        <p className="hint">
          {PRESETS[state.preset].blurb} Flux's defaults are eot_threshold 0.7 and eot_timeout_ms 5000. Flux listen models only.
        </p>
      </div>
    )
  },

  Panel: TurnPanel,
})
