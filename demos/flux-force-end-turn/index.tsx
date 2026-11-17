// ForceEndTurn on Flux: your app decides when a turn ends (push-to-talk, your own VAD, a Send
// button) and tells Flux with one JSON text frame. Flux answers with an EndOfTurn whose trigger is
// "manual". With eot_threshold=1.0, Flux never ends a turn on its own.
// Checked live 2026-11-16 on flux-general-en (macOS voice Samantha, "So for the trip I was
// thinking we could maybe, um", about 3 s, then silence, streamed in real time):
//   eot_threshold=1.0&eot_timeout_ms=30000, no ForceEndTurn: no EndOfTurn (confidence reached 0.94)
//   -> {"type":"ForceEndTurn"} at 6.03 s
//   <- EndOfTurn at 6.14 s (110 ms): "trigger":"manual", "end_of_turn_confidence":0.939,
//      "transcript":"So for the trip I was thinking we could maybe"
//   -> a second ForceEndTurn: Warning FORCE_END_TURN_NO_ACTIVE_TURN ("Received ForceEndTurn while
//      no turn was active; the request was ignored."), and the socket stayed open
//   eot_threshold=0.7, no ForceEndTurn: EndOfTurn at 5.10 s, "trigger":"model", confidence 0.71
//   eot_threshold=0.7, ForceEndTurn at 3.30 s: EndOfTurn at 3.48 s, "trigger":"manual", confidence
//      0.03, 1.6 s before the model ended the same line on its own
// Verified live 2026-11-16: ONLY=flux-force-end-turn pnpm verify:live passed. /v2/listen?model=flux-general-en&eot_threshold=1.0&eot_timeout_ms=30000 and &eot_threshold=0.7 opened; End turn now ({"type":"ForceEndTurn"}) came back EndOfTurn on both, with no Error; prompt.md URL accepted and its ForceEndTurn stop returned an EndOfTurn with words.
import { defineFeature, type Json, type Params, type SttEvent } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

type Who = 'you' | 'both'

interface State {
  // you: eot_threshold=1.0, only ForceEndTurn ends a turn (30 s backstop). both: Flux's default 0.7.
  who: Who
}

export const FORCE: Json = { type: 'ForceEndTurn' }

// The docs' own-turn-detection recipe: 1.0 suppresses Flux's EndOfTurn, and eot_timeout_ms is a
// backstop set well past any pause a person makes on purpose.
export function paramsFor(who: Who): Params {
  return who === 'you' ? { eot_threshold: '1.0', eot_timeout_ms: '30000' } : { eot_threshold: '0.7' }
}

const TRIGGER: Record<string, string> = {
  manual: 'Ended by you',
  model: 'Ended by Flux',
  timeout: 'Ended by the timeout',
}

export type Row =
  | { kind: 'turn'; transcript: string; trigger: string; confidence: number; afterMs?: number }
  | { kind: 'warning'; text: string }

// One row per finished turn, with what ended it and, for a manual end, how long Flux took to
// answer the ForceEndTurn. A ForceEndTurn with no turn open becomes a warning row.
export function rows(events: readonly SttEvent[]): Row[] {
  const out: Row[] = []
  let forcedAt: number | undefined
  for (const e of events) {
    const m = e.msg ?? {}
    if (e.sent && e.name === 'ForceEndTurn') forcedAt = e.ms
    else if (!e.sent && e.name === 'EndOfTurn') {
      const trigger = String(m.trigger ?? 'model')
      out.push({
        kind: 'turn',
        transcript: String(m.transcript ?? ''),
        trigger,
        confidence: Number(m.end_of_turn_confidence ?? 0),
        afterMs: trigger === 'manual' && forcedAt !== undefined ? Math.round(e.ms - forcedAt) : undefined,
      })
      forcedAt = undefined
    } else if (e.name === 'Warning') {
      out.push({ kind: 'warning', text: `${m.code ?? 'Warning'}: no turn was open, so Flux ignored it.` })
      forcedAt = undefined
    }
  }
  return out
}

interface Echo {
  msg: Json
}

export default defineFeature<State>({
  copy: {
    headline: 'You say when the turn ends',
    lede: 'Start the mic and say a sentence that trails off, then stop talking. Flux waits, because eot_threshold=1.0 tells it never to end a turn on its own. Press End turn now: the page sends ForceEndTurn, and Flux ends the turn right then with "trigger": "manual".',
    ctaTitle: 'Bring your own turn detection to Flux.',
    ctaBody: (
      <>
        Set <code>eot_threshold=1.0</code> on <code>/v2/listen</code> and send{' '}
        <code>{'{"type":"ForceEndTurn"}'}</code> when your push-to-talk, VAD, or Send button says the
        turn is over. Flux answers with an <code>EndOfTurn</code> you can hand straight to your agent.
        New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux/own-turn-detection' },
  // Flux only: ForceEndTurn is a message on the Flux socket. Nova-3 answers it with an error.
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux only. ForceEndTurn is a message on the open /v2/listen socket; /v1/listen (Nova-3) does not take it.',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { who: 'you' },
  variants: [{ who: 'you' }, { who: 'both' }],
  promptState: { who: 'you' },

  params: ({ who }): Params => paramsFor(who),
  highlight: ['eot_threshold'],

  runLabel: ({ who }) => (who === 'you' ? 'eot_threshold=1.0, you end every turn' : 'eot_threshold=0.7, Flux or you'),
  compareTip: ({ who }) =>
    who === 'you'
      ? 'Switch to "Flux or you" and say it again without pressing anything, to see when Flux ends it alone.'
      : 'Switch back to "Only you" to see Flux wait for your press.',

  actions: () => [{ label: 'End turn now', message: FORCE, ack: ['EndOfTurn'], primary: true }],
  timeline: { mark: ['ForceEndTurn', 'EndOfTurn', 'Warning'] },

  phrases: () => ['So for the trip, I was thinking we could maybe…', '(stop talking, wait a moment, then press End turn now)'],

  // The last EndOfTurn, or the Warning a ForceEndTurn with no open turn gets.
  echo: (msg): Echo | undefined =>
    (msg.type === 'TurnInfo' && msg.event === 'EndOfTurn') || msg.type === 'Warning' ? { msg } : undefined,

  Controls({ state, setState, ctx }) {
    const pick = (who: Who) => setState({ who })
    return (
      <div className="field fet-field">
        <span className="fet-label">Who ends a turn</span>
        <div className="segmented" role="radiogroup" aria-label="Who ends a turn">
          {(
            [
              ['you', 'Only you (eot_threshold=1.0)'],
              ['both', 'Flux or you (eot_threshold=0.7)'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="radio"
              aria-checked={state.who === v}
              className={state.who === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => pick(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="note">
          {state.who === 'you'
            ? 'Flux keeps the turn open however long you pause. eot_timeout_ms=30000 is the backstop the docs recommend: after 30 s of silence it ends the turn with "trigger": "timeout".'
            : 'Flux ends the turn itself once it is 0.7 sure you are done ("trigger": "model"). Press End turn now first and you win. Press it after, and Flux answers with a Warning, since no turn is open.'}
        </p>
      </div>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">Flux's EndOfTurn shows up here, with its trigger.</span>
    const m = e.msg
    if (m.type === 'Warning') {
      return (
        <span className="wire__part wire__part--text fet-echo">
          <mark>
            "type": "Warning", "code": {JSON.stringify(m.code)}
          </mark>
          , <span className="wire__key">"description":</span> {JSON.stringify(m.description)}
        </span>
      )
    }
    return (
      <span className="wire__part wire__part--text fet-echo">
        <span className="wire__key">"event": "EndOfTurn",</span>{' '}
        <mark>"trigger": {JSON.stringify(m.trigger)}</mark>,{' '}
        <span className="wire__key">"end_of_turn_confidence":</span> {Number(m.end_of_turn_confidence ?? 0).toFixed(2)},{' '}
        <span className="wire__key">"transcript":</span> {JSON.stringify(m.transcript)}
      </span>
    )
  },

  Result({ run, live }) {
    const list = run ? rows(run.events) : []
    const open = run ? run.pending.map((w) => w.text).join(' ') : ''
    if (list.length === 0 && !open) {
      return <EmptyTranscript live={live} text="Each turn shows up here with what ended it." />
    }
    return (
      <div className="transcript fet-rows" aria-live="polite">
        {list.map((r, i) =>
          r.kind === 'turn' ? (
            <div className={`fet-turn is-${r.trigger}`} key={i}>
              <span className="fet-turn__tag">{TRIGGER[r.trigger] ?? `trigger ${r.trigger}`}</span>
              <p className="fet-turn__text">{r.transcript}</p>
              <span className="fet-turn__meta">
                confidence {r.confidence.toFixed(2)}
                {r.afterMs !== undefined && `, ${r.afterMs} ms after ForceEndTurn`}
              </span>
            </div>
          ) : (
            <div className="fet-turn is-warning" key={i}>
              <span className="fet-turn__tag">Warning</span>
              <p className="fet-turn__text">{r.text}</p>
            </div>
          ),
        )}
        {open && (
          <div className="fet-turn is-open">
            <span className="fet-turn__tag">Open turn</span>
            <p className="fet-turn__text word--pending">{open}</p>
          </div>
        )}
      </div>
    )
  },
})
