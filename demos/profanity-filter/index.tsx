// profanity_filter on Nova-3 and Flux: swear words come back starred. Verified live 2026-11-09 on
// /v1/listen and /v2/listen streaming with "This damn demo is so good. Holy shit, it caught every
// word. What the hell." (macOS voice Samantha):
//   off   "This damn demo is so good. Holy shit. It caught every word. What the hell?"
//   on    "This **** demo is so good. Holy ****. It caught every word. What the hell?"
//   Same result on both models. "hell" is not filtered on either.
import { defineFeature, type Params } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { MarkedWords } from '../../shared/stt/MarkedWords'
import { finalTranscript } from '../../shared/stt/stream'
import './styles.css'

interface State {
  on: boolean
}

export const STARRED = /^\*{2,}[.,!?]*$/

export default defineFeature<State>({
  copy: {
    headline: 'Keep it clean.',
    lede: 'Read the phrase, mild language and all. Run it with profanity_filter off, then on, and watch the swear words come back starred.',
    ctaTitle: 'Add profanity_filter=true to your next request.',
    ctaBody: (
      <>
        <code>profanity_filter</code> works on Nova-3 and Flux, streaming and pre-recorded. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/profanity-filter' },
  // Flux first: it takes profanity_filter too.
  models: [
    { id: 'flux', label: 'Flux', endpoint: 'v2', params: { model: 'flux-general-en' } },
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

  // Sent either way, so the Request card always says which one ran.
  params: ({ on }): Params => ({ profanity_filter: String(on) }),
  highlight: ['profanity_filter'],

  runLabel: ({ on }) => `profanity_filter=${on}`,
  actionLabel: ({ on }) => `Run with profanity_filter=${on}`,
  compareTip: ({ on }) =>
    on ? 'Turn profanity_filter off and read it again to compare.' : 'Turn profanity_filter on and read it again to compare.',

  phrases: () => ['This damn demo is so good. Holy shit, it caught every word.'],

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.on} disabled={ctx.busy} onChange={(e) => setState({ on: e.target.checked })} />
        Turn on profanity_filter
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

  Result({ run, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    if (words.length === 0) return <EmptyTranscript live={live} text="Your transcript shows up here, with filtered words marked." />
    return (
      <div className="transcript" aria-live="polite">
        <p className="transcript__text">
          <MarkedWords words={words} match={STARRED} className="starred" />
        </p>
      </div>
    )
  },
})
