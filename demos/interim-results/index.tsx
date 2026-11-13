// interim_results on Nova-3: words show up while you are still talking, then settle. Verified live
// 2026-11-09 on /v1/listen streaming in real time (macOS voice Samantha, 13 s): interim_results=true
// sent 5 interim messages before the finals; interim_results=false sent finals only. Flux always
// streams TurnInfo Update events and refuses interim_results with a 400.
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'

interface State {
  on: boolean
}

const onFlux = (id: string) => id === 'flux'

interface Echo {
  key: 'is_final' | 'event'
  value: string
  transcript: string
}

export default defineFeature<State>({
  copy: {
    headline: 'Watch it think out loud.',
    lede: 'Read the phrase at a normal pace. With interim_results on, words show up in gray while you talk and settle a moment later. With it off, nothing appears until a phrase is done.',
    ctaTitle: 'Add interim_results=true to your next request.',
    ctaBody: (
      <>
        <code>interim_results</code> streams early guesses on Nova-3 at <code>/v1/listen</code>. Flux
        streams them on its own. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/interim-results' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux always streams updates while you talk, so there is no switch: /v2/listen answers interim_results with a 400.',
    },
    { id: 'nova-3', label: 'Nova-3', endpoint: 'v1', params: { model: 'nova-3' } },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: true },
  variants: [{ on: false }, { on: true }],

  // Sent either way on Nova, so the Request card always says which one ran.
  params: ({ on }, { model }): Params => (onFlux(model.id) ? {} : { interim_results: String(on) }),
  highlight: ['interim_results'],

  runLabel: ({ on }, { model }) => (onFlux(model.id) ? 'updates always on' : `interim_results=${on}`),
  actionLabel: ({ on }, { model }) => (onFlux(model.id) ? 'Run' : `Run with interim_results=${on}`),
  compareTip: ({ on }, { model }) =>
    onFlux(model.id)
      ? 'Flip to Nova-3 and read it again to compare.'
      : on
        ? 'Turn interim_results off and read it again to compare.'
        : 'Turn interim_results on and read it again to compare.',

  phrases: () => [
    'I am going to keep talking for a few seconds, without stopping, so you can watch the words show up while I am still speaking.',
  ],

  // The last message with words in it, and whether Deepgram called it final.
  echo(msg): Echo | undefined {
    if (msg.type === 'Results') {
      const alt = ((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
      const transcript = String(alt?.transcript ?? '')
      return transcript ? { key: 'is_final', value: String(msg.is_final === true), transcript } : undefined
    }
    if (msg.type === 'TurnInfo') {
      const transcript = String(msg.transcript ?? '')
      return transcript ? { key: 'event', value: JSON.stringify(msg.event), transcript } : undefined
    }
    return undefined
  },

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={state.on}
          disabled={ctx.busy || onFlux(ctx.model.id)}
          onChange={(e) => setState({ on: e.target.checked })}
        />
        Turn on interim_results
      </label>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The last message with words in it shows up here during a run.</span>
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
    return (
      <PlainTranscript
        committed={run?.committed ?? []}
        pending={run?.pending ?? []}
        live={live}
        emptyText="Your transcript shows up here. Gray words are interim; black ones are final."
      />
    )
  },
})
