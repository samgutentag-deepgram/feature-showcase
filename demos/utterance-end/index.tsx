// utterance_end_ms on Nova-3: an UtteranceEnd message once there is a gap in the words at least
// that long, next to the speech_final that endpointing sends the moment you go quiet.
// Checked live 2026-11-16, streamed in real time: "I want to book a table for" [1.5 s silence]
// "four people tomorrow night." (macOS voice Samantha), times from the socket opening:
//   1000 ms  speech_final 1.79 s, UtteranceEnd 2.80 s (last_word_end 1.52), speech_final 4.74 s,
//            UtteranceEnd 5.76 s (last_word_end 4.43)
//   1500 ms  speech_final 1.77 s and 4.71 s, one UtteranceEnd 6.75 s (last_word_end 4.43)
//   2500 ms  speech_final 1.77 s and 4.72 s, one UtteranceEnd 7.77 s (last_word_end 4.43)
// Without interim_results=true the handshake is a 400 ("Utterance End feature requires interim
// results."), so the card shows it. /v2/listen (Flux) answers utterance_end_ms with a 400
// ("Unknown query parameters: utterance_end_ms").
// Verified live 2026-11-16: ONLY=utterance-end pnpm verify:live passed (3 tests): the socket
// opened for utterance_end_ms 1000, 1500, and 2500 with interim_results=true, and the prompt.md
// URL was accepted. The streamed timings above came from the same day.
import { defineFeature, type Json, type Params, type SttEvent } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

interface State {
  ms: string
}

// 1000 is Deepgram's minimum and the docs' example; 2500 rides out a long mid-sentence pause.
export const VALUES = ['1000', '1500', '2500']

// The run as Deepgram sent it: final text, with a marker where each speech_final and each
// UtteranceEnd arrived. An empty speech_final (the one CloseStream flushes) gets no marker.
export type Piece = { text: string } | { mark: 'speech_final' } | { mark: 'UtteranceEnd'; at: number }

export function pieces(events: readonly SttEvent[]): Piece[] {
  const out: Piece[] = []
  for (const e of events) {
    const m = e.msg
    if (!m || e.sent) continue
    if (e.name === 'Results is_final' || e.name === 'Results speech_final') {
      const alt = ((m.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
      const text = String(alt?.transcript ?? '')
      if (!text) continue
      out.push({ text })
      if (e.name === 'Results speech_final') out.push({ mark: 'speech_final' })
    } else if (e.name === 'UtteranceEnd') {
      out.push({ mark: 'UtteranceEnd', at: Number(m.last_word_end) })
    }
  }
  return out
}

export default defineFeature<State>({
  copy: {
    headline: 'How long a gap ends the utterance?',
    lede: 'Read the phrase with a long pause in the middle. Nova-3 sends speech_final the moment you go quiet. With utterance_end_ms set, it also sends UtteranceEnd, but only once the gap after your last word is at least that long. Try 1000 ms, then 2500 ms, and compare where each one lands.',
    ctaTitle: 'Add utterance_end_ms to your Nova-3 stream.',
    ctaBody: (
      <>
        <code>utterance_end_ms</code> works on streaming <code>/v1/listen</code> with{' '}
        <code>interim_results=true</code>, from 1000 to 5000 ms. It counts the gap after the last finalized word, so a pause shorter
        than your setting does not end the utterance. Flux has its own
        end of turn instead; see the <a href="/demos/turn-detection/">turn detection demo</a>. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/utterance-end' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support utterance_end_ms yet (/v2/listen answers it with a 400). Flux ends turns on its own with EndOfTurn.',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { ms: '1000' },
  variants: VALUES.map((ms) => ({ ms })),

  // interim_results=true is required: without it the handshake is a 400. So it is on the card.
  params: ({ ms }): Params => ({ interim_results: 'true', utterance_end_ms: ms }),
  highlight: ['utterance_end_ms', 'interim_results'],

  runLabel: ({ ms }) => `utterance_end_ms=${ms}`,
  compareTip: ({ ms }) =>
    ms === '2500'
      ? 'Pick 1000 ms and read it again, pause and all, to compare.'
      : 'Pick 2500 ms and read it again, pause and all, to compare.',

  phrases: () => ['I want to book a table for…', '(pause for a slow count of two)', '…four people tomorrow night.', '(then stay quiet for three seconds)'],

  timeline: { mark: ['UtteranceEnd', 'Results speech_final'] },

  // The last UtteranceEnd, verbatim.
  echo: (msg) => (msg.type === 'UtteranceEnd' ? msg : undefined),

  Controls({ state, setState, ctx }) {
    return (
      <div className="field ue-field">
        <span className="ue-field__label">utterance_end_ms: the gap after the last word before UtteranceEnd</span>
        <div className="segmented" role="radiogroup" aria-label="utterance_end_ms">
          {VALUES.map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={state.ms === v}
              className={state.ms === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => setState({ ms: v })}
            >
              {v} ms
            </button>
          ))}
        </div>
      </div>
    )
  },

  Response({ latest }) {
    const m = latest?.echoed as Json | undefined
    if (!m) return <span className="wire__key">The last UtteranceEnd shows up here during a run.</span>
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"type":</span> "UtteranceEnd", <span className="wire__key">"channel":</span>{' '}
        {JSON.stringify(m.channel)}, <mark>"last_word_end": {String(m.last_word_end)}</mark>
      </span>
    )
  },

  Result({ run, live }) {
    const done = run ? pieces(run.events) : []
    const pending = run?.pending.map((w) => w.text).join(' ') ?? ''
    if (done.length === 0 && !pending) {
      return <EmptyTranscript live={live} text="Your transcript shows up here, marked where speech_final and UtteranceEnd arrived." />
    }
    return (
      <p className="transcript ue-flow" aria-live="polite">
        {done.map((p, i) =>
          'text' in p ? (
            <span key={i}>{p.text} </span>
          ) : p.mark === 'speech_final' ? (
            <span key={i} className="ue-mark ue-mark--sf">speech_final</span>
          ) : (
            <span key={i} className="ue-mark ue-mark--ue">UtteranceEnd {p.at.toFixed(2)} s</span>
          ),
        )}
        {pending && <span className="word word--pending">{pending}</span>}
      </p>
    )
  },
})
