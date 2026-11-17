// Flux turn events: the TurnInfo messages every /v2/listen socket sends, as a state machine.
// No eager_eot_threshold here, so this is the default flow (EagerEndOfTurn and TurnResumed only
// arrive with it; that is the flux-eager-eot demo).
// Checked live 2026-11-16 in real time on "My name is Sam. [2 s pause] I need a table for two."
// (macOS voice Samantha), /v2/listen?model=flux-general-en&eot_threshold=0.7, the same twice:
//   Connected, Update 0, StartOfTurn 0 "My name", Update 0 x7, EndOfTurn 0 "My name is Sam."
//   (confidence 0.72, trigger model), Update 1 x4 (empty: the pause), StartOfTurn 1 "I need",
//   Update 1 x9, EndOfTurn 1 "I need a table for two" (0.76, model), Update 2 on the silence after.
//   No EagerEndOfTurn or TurnResumed without eager_eot_threshold, as the docs say.
// Verified live 2026-11-16: ONLY=flux-turn-events pnpm verify:live passed (3 tests: the /v2/listen?model=flux-general-en&eot_threshold=0.7 socket, the prompt URLs, the docs link); the say clip above came back StartOfTurn 0, EndOfTurn 0 "My name is Sam.", StartOfTurn 1, EndOfTurn 1 "I need a table for two", Updates between, no EagerEndOfTurn or TurnResumed.
import { defineFeature, type Json, type SttEvent } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

// The three states in the docs' diagram (https://developers.deepgram.com/docs/flux/state).
export type TurnState = 'Initial' | 'TurnOngoing' | 'AwaitingEnd'

export const NEXT: Record<string, TurnState> = {
  StartOfTurn: 'TurnOngoing',
  EagerEndOfTurn: 'AwaitingEnd',
  TurnResumed: 'TurnOngoing',
  EndOfTurn: 'Initial',
}

const turnInfo = (e: SttEvent): Json | undefined => (e.msg?.type === 'TurnInfo' ? e.msg : undefined)

// Where Flux is now, from the last state change in the run. Update never changes it.
export function turnState(events: readonly SttEvent[]): TurnState {
  for (let i = events.length - 1; i >= 0; i--) {
    const to = NEXT[events[i].name]
    if (to && turnInfo(events[i])) return to
  }
  return 'Initial'
}

// One timeline row. A run of Update events in a row folds into one quiet row with a count.
export interface Row {
  ms: number
  name: string
  count: number
  turnIndex?: number
  transcript: string
  confidence?: number
  trigger?: string
  // Seconds of audio Flux had heard when it sent this.
  audioEnd?: number
}

export function rows(events: readonly SttEvent[]): Row[] {
  const out: Row[] = []
  for (const e of events) {
    if (e.sent) continue
    const m = turnInfo(e)
    const row: Row = {
      ms: e.ms,
      name: e.name,
      count: 1,
      turnIndex: typeof m?.turn_index === 'number' ? m.turn_index : undefined,
      transcript: String(m?.transcript ?? ''),
      confidence: typeof m?.end_of_turn_confidence === 'number' ? m.end_of_turn_confidence : undefined,
      trigger: typeof m?.trigger === 'string' ? m.trigger : undefined,
      audioEnd: typeof m?.audio_window_end === 'number' ? m.audio_window_end : undefined,
    }
    const last = out.at(-1)
    if (row.name === 'Update' && last?.name === 'Update' && last.turnIndex === row.turnIndex) {
      out[out.length - 1] = { ...row, ms: last.ms, count: last.count + 1 }
    } else out.push(row)
  }
  return out
}

interface Echo {
  event: string
  turn_index: unknown
  transcript: string
  trigger?: string
}

const STATES: Array<{ id: TurnState; hint: string }> = [
  { id: 'Initial', hint: 'waiting for speech' },
  { id: 'TurnOngoing', hint: 'you are talking' },
  { id: 'AwaitingEnd', hint: 'needs eager_eot_threshold' },
]

function Diagram({ now }: { now: TurnState }) {
  const box = (id: TurnState) => {
    const s = STATES.find((x) => x.id === id)!
    const cls = ['fsm__state', now === id ? 'is-now' : '', id === 'AwaitingEnd' ? 'is-off' : ''].join(' ').trim()
    return (
      <div className={cls} aria-current={now === id ? 'step' : undefined}>
        <span className="fsm__name">{id}</span>
        <span className="fsm__hint">{s.hint}</span>
      </div>
    )
  }
  return (
    <div className="fsm" role="img" aria-label={`Flux turn state: ${now}`}>
      <div className="fsm__row">
        {box('Initial')}
        <span className="fsm__edge">StartOfTurn →</span>
        {box('TurnOngoing')}
        <span className="fsm__edge is-off">EagerEndOfTurn →</span>
        {box('AwaitingEnd')}
      </div>
      <div className="fsm__back">
        <span className="fsm__edge">← EndOfTurn</span>
        <span className="fsm__edge is-off">← TurnResumed</span>
      </div>
    </div>
  )
}

const fmt = (n: number | undefined, d = 2) => (n === undefined ? '' : n.toFixed(d))

export default defineFeature<Record<string, never>>({
  copy: {
    headline: 'Watch Flux take turns',
    lede: 'Say two short sentences with a pause between them. Flux answers with TurnInfo events: StartOfTurn when you begin, Update about every quarter second, and EndOfTurn when it decides you are done. Each event carries a turn_index, and the diagram follows the state Flux is in.',
    ctaTitle: 'Drive your voice agent from TurnInfo events.',
    ctaBody: (
      <>
        Every Flux socket on <code>/v2/listen</code> sends <code>TurnInfo</code>. Start listening on{' '}
        <code>StartOfTurn</code>, reply on <code>EndOfTurn</code>, and use <code>turn_index</code> to
        keep turns apart. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux/state' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux only. TurnInfo events come on every /v2/listen socket; no param turns them on. Nova-3 has no turn events.',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic' }],
  initialState: {},

  // The default event flow. eot_threshold=0.7 is Flux's own default, sent so the card names what
  // decides EndOfTurn. No eager_eot_threshold on purpose: that is the flux-eager-eot demo.
  params: () => ({ eot_threshold: '0.7' }),
  highlight: ['eot_threshold'],
  runLabel: () => 'default turn events',

  phrases: () => ['My name is Sam.', '(pause for two seconds)', 'I need a table for two.'],

  // Every TurnInfo lands in run.events (Update included) so the page can fold Updates itself.
  timeline: { mark: ['StartOfTurn', 'EagerEndOfTurn', 'TurnResumed', 'EndOfTurn'], quiet: [] },

  // The last state change Flux sent. Update is left out: it never changes the state.
  echo(msg): Echo | undefined {
    if (msg.type !== 'TurnInfo' || msg.event === 'Update') return undefined
    return {
      event: String(msg.event),
      turn_index: msg.turn_index,
      transcript: String(msg.transcript ?? ''),
      ...(typeof msg.trigger === 'string' ? { trigger: msg.trigger } : {}),
    }
  },

  Controls() {
    return (
      <p className="note fte-note">
        No setting to pick: this is the flow you get by default. <code>eot_threshold=0.7</code> is
        Flux&apos;s default: <code>EndOfTurn</code> fires once <code>end_of_turn_confidence</code> passes
        it. <code>EagerEndOfTurn</code> and{' '}
        <code>TurnResumed</code> only arrive when you set <code>eager_eot_threshold</code>, which the
        eager end of turn demo shows. Capping the silence with <code>eot_timeout_ms</code> has a demo of
        its own too.
      </p>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The last StartOfTurn or EndOfTurn shows up here during a run.</span>
    return (
      <span className="wire__part wire__part--text">
        <mark>
          "event": "{e.event}", "turn_index": {String(e.turn_index)}
        </mark>
        , <span className="wire__key">"transcript":</span> {JSON.stringify(e.transcript)}
        {e.trigger && (
          <>
            , <span className="wire__key">"trigger":</span> "{e.trigger}"
          </>
        )}
      </span>
    )
  },

  Result({ run, live }) {
    const events = run?.events ?? []
    if (!run || events.length === 0) {
      return (
        <div className="fte">
          <Diagram now="Initial" />
          <EmptyTranscript live={live} text="Each TurnInfo event shows up here with its time and turn_index." />
        </div>
      )
    }
    return (
      <div className="fte">
        <Diagram now={turnState(events)} />
        <ol className="fte-events" aria-label="TurnInfo events" aria-live="polite">
          {rows(events).map((r, i) => (
            <li key={i} className={`fte-ev fte-ev--${r.name}${NEXT[r.name] ? ' is-change' : ''}`}>
              <span className="fte-ev__ms">{(r.ms / 1000).toFixed(2)} s</span>
              <span className="fte-ev__name">
                {r.name}
                {r.count > 1 ? ` ×${r.count}` : ''}
              </span>
              <span className="fte-ev__turn">{r.turnIndex === undefined ? '' : `turn_index ${r.turnIndex}`}</span>
              <span className="fte-ev__detail">
                {r.transcript ? `"${r.transcript}" ` : ''}
                {r.confidence !== undefined ? `end_of_turn_confidence ${fmt(r.confidence)}` : ''}
                {r.audioEnd !== undefined ? `, audio to ${fmt(r.audioEnd)} s` : ''}
                {r.trigger ? `, trigger ${r.trigger}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  },
})
