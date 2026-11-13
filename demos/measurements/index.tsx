// measurements on Nova-3: spoken units come back abbreviated. Verified live 2026-11-10 in real
// time on "The package weighs five kilograms, it is forty centimeters wide, and it should arrive
// in ten minutes at seventy degrees." (macOS voice Samantha):
//   measurements off   "the package weighs five kilograms ‖ it is forty centimeters wide ‖ ..."
//   measurements=true  "the package weighs 5 kg it is 40 cm wide ‖ ... in ten minutes at seventy degrees"
// Weights and lengths converted; "ten minutes" and "seventy degrees" did not. Flux refuses
// measurements with a 400.
import { defineFeature, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'

interface State {
  on: boolean
}


export default defineFeature<State>({
  copy: {
    headline: 'Five kilograms, or 5 kg?',
    lede: 'Read the phrase with measurements off, then on. Weights and lengths come back as numbers and units, the way a shipping label writes them.',
    ctaTitle: 'Add measurements=true to your next request.',
    ctaBody: (
      <>
        <code>measurements</code> works on Nova-3, on <code>/v1/listen</code>. New accounts start with
        $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/measurements' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support measurements yet (/v2/listen answers it with a 400).',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // Sent either way on Nova, so the Request card always says which one ran.
  params: ({ on }, { model }): Params => ({ measurements: String(on) }),
  highlight: ['measurements'],

  runLabel: ({ on }, { model }) => `measurements=${on}`,
  actionLabel: ({ on }, { model }) => `Run with measurements=${on}`,
  compareTip: ({ on }) =>
    on ? 'Turn measurements off and read it again to compare.' : 'Turn measurements on and read it again to compare.',

  phrases: () => ['The package weighs five kilograms, and it is forty centimeters wide.'],

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
        Turn on measurements
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
        emptyText="Your transcript shows up here. Watch the units."
      />
    )
  },
})
