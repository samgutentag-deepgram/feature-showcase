// filler_words on Nova-3: keep or drop "um" and "uh". Verified live 2026-11-09 on /v1/listen
// streaming with "So, um, I think we should, uh, ship the demo on, um, Thursday. Uh, does that
// work for you?" (macOS voice Samantha):
//   filler_words=false  "So I think we should ship the demo on Thursday. Does that work for you?"
//   filler_words=true   "So I think we should uh, ship the demo on Thursday. Uh, does that work for you?"
//                       (both uh kept, all three um dropped)
//   Flux                keeps all five on its own; filler_words is refused with a 400.
import { defineFeature, type Params } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { MarkedWords } from '../../shared/stt/MarkedWords'
import { finalTranscript } from '../../shared/stt/stream'
import './styles.css'

interface State {
  on: boolean
}

const onFlux = (id: string) => id === 'flux'

export const FILLER = /^(u+[hm]+|h?m+|e+r+|a+h+)[.,!?]*$/i

export default defineFeature<State>({
  copy: {
    headline: 'Um, did it hear that?',
    lede: 'Read the phrase with all its ums and uhs. Run it with filler_words off, then on, and see which hesitations Deepgram keeps.',
    ctaTitle: 'Add filler_words=true to your next request.',
    ctaBody: (
      <>
        <code>filler_words</code> keeps hesitations like "uh" in Nova-3 transcripts, on{' '}
        <code>/v1/listen</code>, streaming and pre-recorded. Flux keeps them by default. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/filler-words' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux keeps filler words on its own, so there is no switch: /v2/listen answers filler_words with a 400. Read the phrase on both models to compare.',
    },
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', smart_format: 'true' },
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // Sent either way on Nova, so the Request card always says which one ran.
  params: ({ on }, { model }): Params => (onFlux(model.id) ? {} : { filler_words: String(on) }),
  highlight: ['filler_words'],

  runLabel: ({ on }, { model }) => (onFlux(model.id) ? 'fillers kept by default' : `filler_words=${on}`),
  actionLabel: ({ on }, { model }) => (onFlux(model.id) ? 'Run' : `Run with filler_words=${on}`),
  compareTip: (_, { model }) =>
    onFlux(model.id)
      ? 'Flip to Nova-3 and read it again to compare.'
      : 'Flip filler_words, or switch to Flux, and read it again to compare.',

  phrases: () => ['So, um, I think we should, uh, ship the demo on, um, Thursday. Uh, does that work for you?'],

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={state.on}
          disabled={ctx.busy || onFlux(ctx.model.id)}
          onChange={(e) => setState({ on: e.target.checked })}
        />
        Turn on filler_words
      </label>
    )
  },

  Response({ latest }) {
    if (typeof latest?.echoed !== 'string') {
      return <span className="wire__key">The last final transcript shows up here after a run.</span>
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"transcript":</span> <mark>{JSON.stringify(latest.echoed)}</mark>
      </span>
    )
  },

  // Every filler Deepgram kept is marked, so a dropped one is easy to spot by its absence.
  Result({ run, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    if (words.length === 0) return <EmptyTranscript live={live} text="Your transcript shows up here, with every um and uh marked." />
    return (
      <div className="transcript" aria-live="polite">
        <p className="transcript__text">
          <MarkedWords words={words} match={FILLER} className="filler" />
        </p>
      </div>
    )
  },
})
