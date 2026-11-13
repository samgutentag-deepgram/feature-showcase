// smart_format on Nova-3: the same audio, written down raw or the way people write.
// Verified live 2026-11-09 on /v1/listen streaming: false gives "four eight one five one six",
// true gives "4815162342", "$129.99", "(555) 212-8899".
import { defineFeature, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'


interface State {
  on: boolean
}

export default defineFeature<State>({
  copy: {
    headline: 'Four eight one five, or 4815?',
    lede: 'Read out a phone number, a date, and a price. Run it with smart_format off, then on, and compare what Deepgram writes down.',
    ctaTitle: 'Add smart_format=true to your next request.',
    ctaBody: (
      <>
        <code>smart_format</code> writes numbers, dates, currency, and phone numbers the way people
        write them, and adds punctuation, on <code>/v1/listen</code>, streaming and pre-recorded. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/smart-format' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support smart_format yet (/v2/listen answers it with a 400).',
    },
  ],
  // Live mic only. Runs stay side by side so the same phrase can be read with it off, then on.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  // Off first, so the second run is the one that changes.
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // Sent either way, so the Request card always says which one ran.
  params: ({ on }, { model }): Params => ({ smart_format: String(on) }),
  highlight: ['smart_format'],

  runLabel: ({ on }, { model }) => `smart_format=${on}`,
  actionLabel: ({ on }, { model }) => `Run with smart_format=${on}`,
  compareTip: ({ on }) =>
    on ? 'Turn smart_format off and run it again to compare.' : 'Turn smart_format on and run it again to compare.',

  phrases: () => [
    'My order number is 4815 1623 42. It ships on March 3rd, 2026, the total is $129.99, and you can call me back at 555-212-8899.',
  ],

  // The last final transcript Deepgram sent, verbatim, from either model.
  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={state.on}
          disabled={ctx.busy}
          onChange={(e) => setState({ on: e.target.checked })}
        />
        Turn on smart_format
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
        emptyText="Your transcript shows up here. Try a phone number, a date, and a price."
      />
    )
  },
})
