// mip_opt_out on Flux and Nova-3: opts a request out of the Model Improvement Partnership Program.
// It changes what Deepgram keeps, not what it writes down, so the page shows what is observable:
// the param on the Request card, the socket accepting it, and a transcript that does not change.
// Checked 2026-11-16 with a 2 s macOS say clip ("Please keep this call out of model training."):
//   /v2/listen flux-general-en and /v1/listen nova-3, streaming: true and false both open and give
//   the same transcript; mip_opt_out=banana fails the handshake on both, so the value is parsed.
//   No Connected, TurnInfo, Results, or Metadata message mentions mip_opt_out.
//   /v1/listen pre-recorded: true and false give the same transcript and the same metadata fields.
import { defineFeature, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'

interface State {
  on: boolean
}

export const DOCS = 'https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program'

export default defineFeature<State>({
  copy: {
    headline: 'Opt out. Same transcript.',
    lede: 'Read the phrase with mip_opt_out off, then on. The words that come back do not change, and no response field says which one ran. What changes is what Deepgram keeps after the request.',
    ctaTitle: 'Add mip_opt_out=true to the requests you want kept out of training.',
    ctaBody: (
      <>
        <code>mip_opt_out</code> works on Flux and Nova-3, streaming and pre-recorded. The docs say
        data from opted-out requests is "retained only for the duration necessary to process the
        request." New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: DOCS },
  // Flux first: /v2/listen takes mip_opt_out (and rejects params it does not know, so this is real).
  models: [
    { id: 'flux', label: 'Flux', endpoint: 'v2', params: { model: 'flux-general-en' } },
    { id: 'nova-3', label: 'Nova-3', endpoint: 'v1', params: { model: 'nova-3' } },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // Sent either way, so the Request card always says which one ran.
  params: ({ on }): Params => ({ mip_opt_out: String(on) }),
  highlight: ['mip_opt_out'],

  runLabel: ({ on }) => `mip_opt_out=${on}`,
  actionLabel: ({ on }) => `Run with mip_opt_out=${on}`,
  compareTip: ({ on }) =>
    on ? 'Turn mip_opt_out off and read it again to compare.' : 'Turn mip_opt_out on and read it again to compare.',

  phrases: () => ['Please keep this call out of model training.'],

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.on} disabled={ctx.busy} onChange={(e) => setState({ on: e.target.checked })} />
          Turn on mip_opt_out
        </label>
        <p className="note">
          Nothing to see in the transcript, by design. The effect is on data use, not on what Deepgram
          writes down. The only visible check is that the value must be true or false: anything else
          is refused when the socket opens.
        </p>
      </>
    )
  },

  Response({ latest }) {
    if (typeof latest?.echoed !== 'string') {
      return <span className="wire__key">The last final transcript shows up here after a run. No response field echoes mip_opt_out.</span>
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
        emptyText="Your transcript shows up here. Run it off, then on, and compare."
      />
    )
  },
})
