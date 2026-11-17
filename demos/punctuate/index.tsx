// punctuate on Nova-3: a lowercase run of words, or sentences with capitals, commas, and a
// question mark. Checked 2026-11-16 on /v1/listen streaming with "Did you get my message? I left
// it on Tuesday. Call me back when you can." (macOS voice Samantha):
//   punctuate=false  "did you get my message" / "i left it on tuesday" / "call me back when you can"
//   punctuate=true   "Did you get my message?" / "I left it on Tuesday." / "Call me back when you can."
//   Flux             punctuates on its own; /v2/listen answers punctuate with a 400
//                    (INVALID_QUERY_PARAMETER, "Unknown query parameters: punctuate").
// smart_format is never sent here: it turns punctuation on by itself (see demos/smart-format).
import { defineFeature, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'

interface State {
  on: boolean
}

const onFlux = (id: string) => id === 'flux'

export default defineFeature<State>({
  copy: {
    headline: 'Did it hear the question mark?',
    lede: 'Read a question and two short sentences. Run it with punctuate off, then on, and watch the capitals, periods, and question mark appear.',
    ctaTitle: 'Add punctuate=true to your next request.',
    ctaBody: (
      <>
        <code>punctuate</code> adds punctuation and capitalization to Nova-3 transcripts, on{' '}
        <code>/v1/listen</code>, streaming and pre-recorded. <code>smart_format=true</code> turns it on
        too, so you only need one of them. Flux punctuates by default. New accounts start with $200 in
        free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/punctuation' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux punctuates and capitalizes on its own, so there is no switch: /v2/listen answers punctuate with a 400. Read the phrase on both models to compare.',
    },
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'smart_format is left off here because it turns punctuation on by itself.',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  // Off first, so the second run is the one that changes.
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // Sent either way on Nova, so the Request card always says which one ran.
  params: ({ on }, { model }): Params => (onFlux(model.id) ? {} : { punctuate: String(on) }),
  highlight: ['punctuate'],

  runLabel: ({ on }, { model }) => (onFlux(model.id) ? 'punctuated by default' : `punctuate=${on}`),
  actionLabel: ({ on }, { model }) => (onFlux(model.id) ? 'Run' : `Run with punctuate=${on}`),
  compareTip: ({ on }, { model }) =>
    onFlux(model.id)
      ? 'Flip to Nova-3 and read it again to compare.'
      : on
        ? 'Turn punctuate off, or switch to Flux, and read it again to compare.'
        : 'Turn punctuate on, or switch to Flux, and read it again to compare.',

  phrases: () => ['Did you get my message? I left it on Tuesday. Call me back when you can.'],

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
        Turn on punctuate
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
        emptyText="Your transcript shows up here. Ask a question, then say a sentence or two."
      />
    )
  },
})
