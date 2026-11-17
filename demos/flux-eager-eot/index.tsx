// Eager end of turn on Flux: eager_eot_threshold makes Flux send EagerEndOfTurn as soon as it is
// fairly sure you are done, so an agent can start its LLM call early. TurnResumed cancels that
// draft if you keep talking; EndOfTurn confirms it with the same transcript.
// Checked live 2026-11-16 in real time on "I'd like to book. [1.2 s] Um. [0.9 s] A table for two."
// (macOS voice Samantha), /v2/listen?model=flux-general-en, eot_threshold=0.7 on every run:
//   eager off   StartOfTurn, EndOfTurn "I'd like to book, um, a table for two." Nothing early.
//   0.4         EagerEndOfTurn "I'd like to book." > TurnResumed > EagerEndOfTurn "I'd like to
//               book." > TurnResumed > EagerEndOfTurn (full sentence) > EndOfTurn 441 ms later.
//               3 drafts, 2 cancelled.
//   0.6         EagerEndOfTurn "I'd like to book." > TurnResumed > EagerEndOfTurn (full sentence)
//               > EndOfTurn 81 ms later. 2 drafts, 1 cancelled.
//   eager_eot_threshold=0.8 with eot_threshold=0.7 is a 400 at the handshake: INVALID_QUERY_PARAMETER
//   "eager_eot_threshold cannot be greater than eot_threshold." 0.2 is a 400 too: "must be between
//   0.3 and 0.9, inclusive."
import { defineFeature, type Json, type Params, type SttEvent } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

type Eager = 'off' | '0.4' | '0.6'

interface State {
  eager: Eager
}

// Flux's default, sent on every run so the card shows what eager_eot_threshold must stay under.
export const EOT = '0.7'
export const EAGER: Eager[] = ['off', '0.4', '0.6']

// What one turn did, from the run's timeline. Times are when the page got each event.
export interface TurnSummary {
  index: number
  start?: number
  end?: number
  transcript: string
  // Every EagerEndOfTurn: one speculative LLM call each. resumed means a TurnResumed cancelled it.
  drafts: Array<{ ms: number; transcript: string; resumed?: number }>
  // ms between the EagerEndOfTurn that held and EndOfTurn: how much earlier the LLM could start.
  headStart?: number
}

const turnInfo = (e: SttEvent): Json | undefined => (e.msg?.type === 'TurnInfo' ? e.msg : undefined)

export function summarize(events: readonly SttEvent[]): TurnSummary[] {
  const turns = new Map<number, TurnSummary>()
  for (const e of events) {
    const m = turnInfo(e)
    if (!m || typeof m.turn_index !== 'number') continue
    const t = turns.get(m.turn_index) ?? { index: m.turn_index, transcript: '', drafts: [] }
    turns.set(m.turn_index, t)
    const transcript = String(m.transcript ?? '')
    const open = t.drafts.at(-1)
    if (e.name === 'StartOfTurn') t.start ??= e.ms
    else if (e.name === 'EagerEndOfTurn') t.drafts.push({ ms: e.ms, transcript })
    else if (e.name === 'TurnResumed' && open && open.resumed === undefined) open.resumed = e.ms
    else if (e.name === 'EndOfTurn') {
      t.end = e.ms
      t.transcript = transcript
      if (open && open.resumed === undefined) t.headStart = e.ms - open.ms
    }
  }
  return [...turns.values()].filter((t) => t.start !== undefined || t.drafts.length || t.end !== undefined)
}

interface Echo {
  event: string
  transcript: string
  confidence: number
}

const ms = (n: number) => `${Math.round(n)} ms`

// One turn on a line: when it started, every draft, every cancel, and the confirmed end.
function Track({ turn }: { turn: TurnSummary }) {
  const t0 = turn.start ?? turn.drafts[0]?.ms ?? 0
  const t1 = Math.max(turn.end ?? 0, ...turn.drafts.map((d) => d.resumed ?? d.ms), t0 + 1)
  const at = (n: number) => `${((n - t0) / (t1 - t0)) * 100}%`
  const held = turn.headStart !== undefined ? turn.drafts.at(-1) : undefined
  return (
    <div className="eot-track" aria-hidden="true">
      <span className="eot-track__line" />
      {held && turn.end !== undefined && (
        <span className="eot-track__gain" style={{ left: at(held.ms), width: `calc(${at(turn.end)} - ${at(held.ms)})` }} />
      )}
      {turn.drafts.map((d, i) => (
        <span key={`e${i}`}>
          <span className={d.resumed === undefined ? 'eot-tick eot-tick--eager' : 'eot-tick eot-tick--eager is-cancelled'} style={{ left: at(d.ms) }} title="EagerEndOfTurn" />
          {d.resumed !== undefined && <span className="eot-tick eot-tick--resumed" style={{ left: at(d.resumed) }} title="TurnResumed" />}
        </span>
      ))}
      {turn.end !== undefined && <span className="eot-tick eot-tick--end" style={{ left: at(turn.end) }} title="EndOfTurn" />}
    </div>
  )
}

function Turn({ turn, eager }: { turn: TurnSummary; eager: Eager }) {
  const cancelled = turn.drafts.filter((d) => d.resumed !== undefined).length
  return (
    <div className="eot-turn">
      <p className="eot-turn__text">{turn.transcript || turn.drafts.at(-1)?.transcript || '…'}</p>
      <Track turn={turn} />
      <ul className="eot-drafts">
        {turn.drafts.map((d, i) => (
          <li key={i} className={d.resumed === undefined ? 'eot-draft' : 'eot-draft is-cancelled'}>
            <span className="eot-draft__tag">EagerEndOfTurn</span> <span className="eot-draft__text">"{d.transcript}"</span>{' '}
            <span className="eot-draft__then">
              {d.resumed !== undefined
                ? `TurnResumed ${ms(d.resumed - d.ms)} later: draft cancelled`
                : turn.end !== undefined
                  ? `EndOfTurn ${ms(turn.end - d.ms)} later: draft kept`
                  : 'waiting'}
            </span>
          </li>
        ))}
      </ul>
      <dl className="eot-stats">
        <div>
          <dt>LLM calls started</dt>
          <dd>{eager === 'off' ? (turn.end !== undefined ? 1 : 0) : turn.drafts.length}</dd>
        </div>
        <div>
          <dt>Cancelled</dt>
          <dd>{cancelled}</dd>
        </div>
        <div className={turn.headStart ? 'is-gain' : ''}>
          <dt>Head start</dt>
          <dd>{turn.headStart !== undefined ? ms(turn.headStart) : turn.end !== undefined ? '0 ms' : '…'}</dd>
        </div>
      </dl>
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'Start the reply before they finish',
    lede: 'Read the line with a hesitation in the middle. With eager_eot_threshold set, Flux sends EagerEndOfTurn when it is fairly sure you are done, so an agent can start its LLM call early. If you keep talking, TurnResumed cancels that draft. EndOfTurn confirms the last one, and the gap between them is time your agent saves.',
    ctaTitle: 'Draft on EagerEndOfTurn, send on EndOfTurn.',
    ctaBody: (
      <>
        Add <code>eager_eot_threshold</code> to your <code>/v2/listen</code> URL, at or below{' '}
        <code>eot_threshold</code>. Start a draft on <code>EagerEndOfTurn</code>, drop it on{' '}
        <code>TurnResumed</code>, and send it on <code>EndOfTurn</code>: the transcript matches. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux/voice-agent-eager-eot' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux only. EagerEndOfTurn and TurnResumed are Flux turn events; Nova-3 has no turn events.',
    },
  ],
  // Runs stay side by side: read it with eager off, then on, and compare.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { eager: 'off' },
  variants: EAGER.map((eager) => ({ eager })),
  promptState: { eager: '0.4' },

  // eot_threshold goes on every run, so the card shows the ceiling eager_eot_threshold sits under.
  params: ({ eager }): Params => (eager === 'off' ? { eot_threshold: EOT } : { eager_eot_threshold: eager, eot_threshold: EOT }),
  highlight: ['eager_eot_threshold'],

  runLabel: ({ eager }) => (eager === 'off' ? 'eager off' : `eager_eot_threshold=${eager}`),
  compareTip: ({ eager }) =>
    eager === 'off' ? 'Pick 0.4 and read it again, hesitation and all.' : 'Try another setting and read it again to compare.',

  phrases: () => ['I’d like to book…', '(say “um” and pause for a second)', '…a table for two.'],

  // EagerEndOfTurn, TurnResumed and EndOfTurn stand out; StartOfTurn shows too, Update stays quiet.
  timeline: { mark: ['EagerEndOfTurn', 'TurnResumed', 'EndOfTurn'] },

  echo(msg): Echo | undefined {
    if (msg.type !== 'TurnInfo' || !['EagerEndOfTurn', 'TurnResumed', 'EndOfTurn'].includes(String(msg.event))) return undefined
    return { event: String(msg.event), transcript: String(msg.transcript ?? ''), confidence: Number(msg.end_of_turn_confidence ?? 0) }
  },

  Controls({ state, setState, ctx }) {
    return (
      <div className="field eot-field">
        <span className="eot-field__label">eager_eot_threshold: how sure Flux must be before it sends EagerEndOfTurn</span>
        <div className="segmented" role="radiogroup" aria-label="eager_eot_threshold">
          {EAGER.map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={state.eager === v}
              className={state.eager === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => setState({ eager: v })}
            >
              {v === 'off' ? 'Off' : v}
            </button>
          ))}
        </div>
        <p className="note">
          It must be between 0.3 and 0.9 and no higher than <code>eot_threshold</code> (0.7 here). Checked live:{' '}
          <code>eager_eot_threshold=0.8&amp;eot_threshold=0.7</code> is a 400 at the handshake, “eager_eot_threshold
          cannot be greater than eot_threshold.” Lower means earlier drafts and more of them cancelled.
        </p>
      </div>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The last EagerEndOfTurn, TurnResumed, or EndOfTurn shows up here during a run.</span>
    return (
      <span className="wire__part wire__part--text">
        <mark>"event": "{e.event}"</mark>, <span className="wire__key">"transcript":</span> {JSON.stringify(e.transcript)},{' '}
        <span className="wire__key">"end_of_turn_confidence":</span> {e.confidence.toFixed(2)}
      </span>
    )
  },

  Result({ run, live }) {
    const turns = summarize(run?.events ?? [])
    if (!run || turns.length === 0) {
      return <EmptyTranscript live={live} text="Each turn shows up here with its drafts, cancels, and the head start eager end of turn gave." />
    }
    return (
      <div className="eot" aria-live="polite">
        {turns.map((t) => (
          <Turn key={t.index} turn={t} eager={run.state.eager} />
        ))}
        <p className="eot-legend" aria-hidden="true">
          <span className="eot-key eot-key--eager">EagerEndOfTurn</span>
          <span className="eot-key eot-key--resumed">TurnResumed</span>
          <span className="eot-key eot-key--end">EndOfTurn</span>
          <span className="eot-key eot-key--gain">head start</span>
        </p>
      </div>
    )
  },
})
