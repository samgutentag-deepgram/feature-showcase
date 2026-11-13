// Turn detection: when does the model decide you stopped talking? Nova-3 waits for silence
// (endpointing, in ms); Flux decides from the words and the audio together (eot_threshold).
// Verified live 2026-11-09 in real time on "I want to book a table for [1.2 s pause] four people
// tomorrow night. [2.5 s] Somewhere quiet, if you can." (macOS voice Samantha):
//   Nova-3 endpointing=10     4 turns: "i want to book a table for" | "four people tomorrow night" | ...
//   Nova-3 endpointing=300    3 turns, still cut after "a table for"
//   Nova-3 endpointing=2000   no turn ends at all
//   Flux eot_threshold=0.5, 0.7, 0.9   2 turns: the two full sentences, never cut mid-sentence
import { defineFeature, type Json, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

interface State {
  endpointing: string
  eot: string
}

const onFlux = (id: string) => id === 'flux'

// Deepgram's defaults first: endpointing=10 on Nova-3, eot_threshold=0.7 on Flux.
export const ENDPOINTING = ['10', '300', '2000']
export const EOT = ['0.5', '0.7', '0.9']

// Words become one row per turn; the last row stays open until the model ends it.
export function turns(words: readonly Word[]): Array<{ words: Word[]; done: boolean }> {
  const rows: Array<{ words: Word[]; done: boolean }> = []
  for (const w of words) {
    const last = rows.at(-1)
    if (!last || last.done) rows.push({ words: [w], done: !!w.endsTurn })
    else {
      last.words.push(w)
      last.done = !!w.endsTurn
    }
  }
  return rows
}

interface Echo {
  key: string
  value: string
  transcript: string
}

export default defineFeature<State>({
  copy: {
    headline: 'Did it cut you off?',
    lede: 'Start a sentence, pause for a second in the middle, then finish it. Nova-3 ends a turn on silence. Flux listens to what you said, so a pause mid-sentence is not the end. Run it on both and compare.',
    ctaTitle: 'Pick the turn detection your agent needs.',
    ctaBody: (
      <>
        Nova-3 takes <code>endpointing</code> on <code>/v1/listen</code>. Flux takes{' '}
        <code>eot_threshold</code> on <code>/v2/listen</code>, and was built for voice agents. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux/quickstart' },
  // Flux first: turn detection is what it was built for.
  models: [
    { id: 'flux', label: 'Flux', endpoint: 'v2', params: { model: 'flux-general-en' } },
    { id: 'nova-3', label: 'Nova-3', endpoint: 'v1', params: { model: 'nova-3' } },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { endpointing: '10', eot: '0.7' },
  variants: [
    { endpointing: '10', eot: '0.5' },
    { endpointing: '300', eot: '0.7' },
    { endpointing: '2000', eot: '0.9' },
  ],

  params: ({ endpointing, eot }, { model }): Params =>
    onFlux(model.id) ? { eot_threshold: eot } : { endpointing },
  highlight: ['endpointing', 'eot_threshold'],

  runLabel: ({ endpointing, eot }, { model }) =>
    onFlux(model.id) ? `eot_threshold=${eot}` : `endpointing=${endpointing} ms`,
  compareTip: (_, { model }) =>
    onFlux(model.id)
      ? 'Flip to Nova-3 and read it again, pause and all, to compare.'
      : 'Flip to Flux and read it again, pause and all, to compare.',

  phrases: () => ['I want to book a table for…', '(pause for a full second)', '…four people tomorrow night.'],

  // The last turn end Deepgram sent: speech_final on Nova-3, an EndOfTurn event on Flux.
  echo(msg): Echo | undefined {
    if (msg.type === 'Results' && msg.speech_final === true) {
      const alt = ((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
      return { key: 'speech_final', value: 'true', transcript: String(alt?.transcript ?? '') }
    }
    if (msg.type === 'TurnInfo' && msg.event === 'EndOfTurn') {
      return { key: 'event', value: '"EndOfTurn"', transcript: String(msg.transcript ?? '') }
    }
    return undefined
  },

  Controls({ state, setState, ctx }) {
    const flux = onFlux(ctx.model.id)
    const options = flux ? EOT : ENDPOINTING
    const value = flux ? state.eot : state.endpointing
    const pick = (v: string) => setState(flux ? { ...state, eot: v } : { ...state, endpointing: v })
    return (
      <div className="field turn-field">
        <span className="turn-field__label">
          {flux ? 'eot_threshold: how sure Flux must be that you are done' : 'endpointing: ms of silence before Nova-3 ends a turn'}
        </span>
        <div className="segmented" role="radiogroup" aria-label={flux ? 'eot_threshold' : 'endpointing'}>
          {options.map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={value === v}
              className={value === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => pick(v)}
            >
              {flux ? v : `${v} ms`}
            </button>
          ))}
        </div>
      </div>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The last end of turn shows up here during a run.</span>
    return (
      <span className="wire__part wire__part--text">
        <mark>
          "{e.key}": {e.value}
        </mark>
        , <span className="wire__key">"transcript":</span> {JSON.stringify(e.transcript)}
      </span>
    )
  },

  Result({ run, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    if (words.length === 0) return <EmptyTranscript live={live} text="Your transcript shows up here, one row per turn." />
    return (
      <div className="transcript" aria-live="polite">
        {turns(words).map((t, i) => (
          <div className={t.done ? 'turn is-done' : 'turn'} key={i}>
            <span className="turn__num">Turn {i + 1}</span>
            <p className="turn__words">
              {t.words.map((w, j) => (
                <span key={j} className={w.pending ? 'word word--pending' : 'word'}>
                  {w.text}{' '}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    )
  },
})
