// numerals on Flux and Nova-3: spoken numbers come back as digits, and nothing else changes.
// Verified live 2026-11-10 in real time on "I need twenty five boxes, three hundred and twelve
// labels, and two thousand twenty six stickers by the fifteenth." (macOS voice Samantha):
//   Flux, numerals off   "... twenty five boxes, three hundred and twelve labels ... the fifteenth."
//   Flux, numerals=true  "I need 25 boxes, 312 labels, and 2026 stickers by the 15th."
//   Nova-3 numerals=true "i need 25 boxes ‖ 312 labels ‖ and 2026 stickers by the 15th"
// smart_format would also do this, plus punctuation and capitals; numerals is only the digits.
import { defineFeature, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'

interface State {
  on: boolean
}

export default defineFeature<State>({
  copy: {
    headline: 'Twenty five, or 25?',
    lede: 'Read the phrase with numerals off, then on. Spoken numbers come back as digits, and nothing else about the transcript changes.',
    ctaTitle: 'Add numerals=true to your next request.',
    ctaBody: (
      <>
        <code>numerals</code> works on Flux and Nova-3. Want punctuation and dates too? That is{' '}
        <code>smart_format</code>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/numerals' },
  // Flux first: it takes numerals too.
  models: [
    { id: 'flux', label: 'Flux', endpoint: 'v2', params: { model: 'flux-general-en' } },
    { id: 'nova-3', label: 'Nova-3', endpoint: 'v1', params: { model: 'nova-3' } },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // Sent either way, so the Request card always says which one ran.
  params: ({ on }): Params => ({ numerals: String(on) }),
  highlight: ['numerals'],

  runLabel: ({ on }) => `numerals=${on}`,
  actionLabel: ({ on }) => `Run with numerals=${on}`,
  compareTip: ({ on }) => (on ? 'Turn numerals off and read it again to compare.' : 'Turn numerals on and read it again to compare.'),

  phrases: () => ['I need twenty five boxes, three hundred and twelve labels, and two thousand twenty six stickers by the fifteenth.'],

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.on} disabled={ctx.busy} onChange={(e) => setState({ on: e.target.checked })} />
        Turn on numerals
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
    return (
      <PlainTranscript
        committed={run?.committed ?? []}
        pending={run?.pending ?? []}
        live={live}
        emptyText="Your transcript shows up here. Watch the numbers."
      />
    )
  },
})
