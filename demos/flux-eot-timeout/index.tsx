// eot_timeout_ms on Flux: the most silence Flux waits before it forces EndOfTurn, even when the
// model is not sure the turn is over. Every EndOfTurn says why it ended in `trigger`: "model" (Flux
// decided) or "timeout" (eot_timeout_ms ran out). The eot_threshold dial is the turn-detection demo.
// Checked live 2026-11-16 in real time on "So I was thinking that maybe we could..." (macOS voice
// Samantha, last word ends at 2.00 s) then 6 s of silence, /v2/listen?model=flux-general-en.
// Silence = audio_window_end minus the last word's end:
//   eot_threshold=1.0  eot_timeout_ms=1000   EndOfTurn after 1.36 s of silence, trigger "timeout"
//   eot_threshold=1.0  eot_timeout_ms=3000   EndOfTurn after 3.28 s, trigger "timeout"
//   eot_threshold=1.0  eot_timeout_ms=5000   EndOfTurn after 5.20 s, trigger "timeout"
//   eot_threshold=0.7  any of the three      EndOfTurn after 1.04 s, trigger "model" (confidence 0.73)
//   eot_threshold=0.9  eot_timeout_ms=1000   trigger "timeout" at 1.36 s; at 3000 and 5000, "model" at 1.68 s
//   eot_timeout_ms=499 and 60001 are a 400 at the handshake: INVALID_QUERY_PARAMETER
//   "eot_timeout_ms must be between 500 and 60000, inclusive."
import { defineFeature, type Json, type Params, type SttEvent } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

type Timeout = '1000' | '3000' | '5000'
type Threshold = '0.7' | '1.0'

interface State {
  timeout: Timeout
  eot: Threshold
}

// 5000 is Flux's default; sent anyway so the card always says which one ran.
export const TIMEOUTS: Timeout[] = ['1000', '3000', '5000']
export const THRESHOLDS: Threshold[] = ['1.0', '0.7']

const lastWordEnd = (m: Json): number | undefined => {
  const end = (m.words as Json[] | undefined)?.at(-1)?.end
  return typeof end === 'number' ? end : undefined
}

// Seconds of audio between the last word and the end of what Flux has heard.
export function silence(m: Json): number | undefined {
  const end = lastWordEnd(m)
  const heard = m.audio_window_end
  return end === undefined || typeof heard !== 'number' ? undefined : Math.max(0, heard - end)
}

export interface Ended {
  ms: number
  transcript: string
  trigger: string
  silence?: number
  confidence: number
}

// Every EndOfTurn in a run, with what ended it and how long the silence was.
export function endings(events: readonly SttEvent[]): Ended[] {
  return events
    .filter((e) => e.name === 'EndOfTurn' && e.msg)
    .map((e) => {
      const m = e.msg as Json
      return {
        ms: e.ms,
        transcript: String(m.transcript ?? ''),
        trigger: String(m.trigger ?? 'unknown'),
        silence: silence(m),
        confidence: Number(m.end_of_turn_confidence ?? 0),
      }
    })
}

// The newest TurnInfo, for the live silence counter while a turn is still open.
interface Live {
  event: string
  turn: number
  silence?: number
}

const secs = (n: number) => `${n.toFixed(2)} s`

function Waiting({ live, timeout }: { live: Live; timeout: number }) {
  const s = live.silence ?? 0
  const pct = Math.min(100, (s / timeout) * 100)
  return (
    <div className="eto-wait">
      <p className="eto-wait__label">
        Silence so far <strong>{secs(s)}</strong> of {secs(timeout)}
      </p>
      <div className="eto-bar" aria-hidden="true">
        <span className="eto-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Turn({ t, timeout }: { t: Ended; timeout: number }) {
  return (
    <div className="eto-turn">
      <p className="eto-turn__text">{t.transcript || '…'}</p>
      <dl className="eto-stats">
        <div className={t.trigger === 'timeout' ? 'is-timeout' : ''}>
          <dt>trigger</dt>
          <dd>{t.trigger}</dd>
        </div>
        <div>
          <dt>Silence before EndOfTurn</dt>
          <dd>{t.silence !== undefined ? secs(t.silence) : '…'}</dd>
        </div>
        <div>
          <dt>eot_timeout_ms</dt>
          <dd>{secs(timeout)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{t.confidence.toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'How long will Flux wait for you?',
    lede: 'Start a sentence, trail off, and stay quiet. eot_timeout_ms is the most silence Flux allows before it ends the turn anyway, sure or not. Every EndOfTurn says why it ended: trigger "model" when Flux decided you were done, "timeout" when the clock ran out.',
    ctaTitle: 'Set a backstop for every turn.',
    ctaBody: (
      <>
        Add <code>eot_timeout_ms</code> (500 to 60000, default 5000) to your <code>/v2/listen</code>{' '}
        URL, and read <code>trigger</code> on each <code>EndOfTurn</code> to tell a timeout from a real
        end of turn. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux/configuration' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux only. eot_timeout_ms is a Flux turn setting; Nova-3 ends turns on silence with endpointing.',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { timeout: '5000', eot: '1.0' },
  variants: [
    { timeout: '1000', eot: '1.0' },
    { timeout: '3000', eot: '0.7' },
    { timeout: '5000', eot: '1.0' },
  ],
  promptState: { timeout: '3000', eot: '0.7' },

  params: ({ timeout, eot }): Params => ({ eot_threshold: eot, eot_timeout_ms: timeout }),
  highlight: ['eot_timeout_ms'],

  runLabel: ({ timeout, eot }) => `eot_timeout_ms=${timeout}, eot_threshold=${eot}`,
  compareTip: ({ timeout }) =>
    timeout === '1000' ? 'Pick 5000 and trail off again to compare.' : 'Pick 1000 and trail off again to compare.',

  phrases: () => ['So I was thinking that maybe we could…', '(then stop, and stay quiet until the turn ends)'],

  timeline: { mark: ['EndOfTurn'] },

  echo(msg): Live | undefined {
    if (msg.type !== 'TurnInfo') return undefined
    return { event: String(msg.event), turn: Number(msg.turn_index ?? 0), silence: silence(msg) }
  },

  Controls({ state, setState, ctx }) {
    return (
      <div className="field eto-field">
        <span className="eto-field__label">eot_timeout_ms: the most silence before Flux ends the turn anyway</span>
        <div className="segmented" role="radiogroup" aria-label="eot_timeout_ms">
          {TIMEOUTS.map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={state.timeout === v}
              className={state.timeout === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => setState({ ...state, timeout: v })}
            >
              {v} ms{v === '5000' ? ' (default)' : ''}
            </button>
          ))}
        </div>
        <span className="eto-field__label">eot_threshold: may Flux end the turn on its own?</span>
        <div className="segmented" role="radiogroup" aria-label="eot_threshold">
          {THRESHOLDS.map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={state.eot === v}
              className={state.eot === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => setState({ ...state, eot: v })}
            >
              {v === '1.0' ? '1.0: only the timeout' : '0.7: Flux decides (default)'}
            </button>
          ))}
        </div>
        <p className="note">
          At <code>eot_threshold=1.0</code> Flux never ends a turn on its own, so the timeout is the only
          thing that can, and you see it exactly. At 0.7, Flux's default, it ended our trailing test
          sentence itself after about a second (trigger <code>model</code>), so the timeout only catches
          turns Flux stays unsure about. The allowed range is 500 to 60000; 499 is a 400 at the handshake.
        </p>
      </div>
    )
  },

  Response({ latest }) {
    const e = latest?.events.filter((x) => x.name === 'EndOfTurn').at(-1)?.msg
    if (!e) return <span className="wire__key">The last EndOfTurn shows up here during a run.</span>
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"event":</span> "EndOfTurn", <mark>"trigger": {JSON.stringify(String(e.trigger ?? ''))}</mark>,{' '}
        <span className="wire__key">"audio_window_end":</span> {Number(e.audio_window_end ?? 0).toFixed(2)},{' '}
        <span className="wire__key">"transcript":</span> {JSON.stringify(String(e.transcript ?? ''))}
      </span>
    )
  },

  Result({ run, live }) {
    const ended = endings(run?.events ?? [])
    const now = run?.echoed as Live | undefined
    const timeout = Number(run?.state.timeout ?? 5000) / 1000
    // A turn is open when the newest TurnInfo is not an EndOfTurn and has words in it.
    const open = live && now && now.event !== 'EndOfTurn' && now.turn >= ended.length && now.silence !== undefined
    if (!run || (ended.length === 0 && !open)) {
      return <EmptyTranscript live={live} text="Each turn shows up here with what ended it and how much silence came first." />
    }
    return (
      <div className="eto" aria-live="polite">
        {ended.map((t, i) => (
          <Turn key={i} t={t} timeout={timeout} />
        ))}
        {open && now && <Waiting live={now} timeout={timeout} />}
      </div>
    )
  },
})
