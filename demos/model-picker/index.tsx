// model: the same line through Flux and five Nova-era models, two runs side by side.
// Checked 2026-11-16 with a macOS voice (Samantha) reading "Doctor Okonkwo moved the Kubernetes
// rollout to March third. Send forty two dollars to Siobhan." (plus a phone number on the
// streaming read). Streaming, no params but model:
//   flux-general-en  "Doctor Aconquo moved the Kubernetes rollout to March third. ... Siobhan"
//   nova-3, nova-2   "doctor okonkwo moved the kubernetes rollout ... siobhan"
//   nova             "doctor akanko moved the cuba needs rollout ... to chevron"
//   enhanced         "doctor o'conquo moved the kubernetes rollout ... siobhan"
//   base             "doctor a moved the cuban needs rollout ... siobhan"
// Pre-recorded /v1/listen on the 5 s line: nova-3 "akankwo", nova-2 "okonkwo", nova "akanko" and
// "chevron", enhanced "ocanto", base "a" and "qb needs". Names move between runs; jargon and
// first names split old from new.
// model_info.name in Nova results: general-nova-3, 2-general-nova, general-nova, general-enhanced,
// general (base). Flux results carry no model_info.
// nova-3-medical and flux-general-multi also opened on the socket; they are left to the docs.
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'
import './styles.css'

interface State {
  // The model sent when the Nova toggle is picked. Flux always sends flux-general-en.
  nova: string
}

const FLUX_MODEL = 'flux-general-en'

// Newest first. Each one opened on /v1/listen with this key on 2026-11-16.
export const NOVA_MODELS = ['nova-3', 'nova-2', 'nova', 'enhanced', 'base'] as const

const onFlux = (endpoint: string) => endpoint === 'v2'

export const modelFor = (state: State, endpoint: string) => (onFlux(endpoint) ? FLUX_MODEL : state.nova)

interface Echo {
  // model_info.name and .version from a Nova result, so the run says which model answered.
  // Flux results do not carry model_info.
  name?: string
  version?: string
  transcript: string
}

export default defineFeature<State>({
  copy: {
    headline: 'Siobhan, or Chevron?',
    lede: 'Read one line with a surname, a first name, and some jargon. Run it on Flux, then on a Nova model, and the two transcripts sit side by side. Older models miss more of the names.',
    ctaTitle: 'Pick the model in one query param.',
    ctaBody: (
      <>
        <code>model</code> picks the speech-to-text model: <code>flux-general-en</code> on{' '}
        <code>/v2/listen</code> for voice agents, <code>nova-3</code> and older on <code>/v1/listen</code>. Domain
        options such as <code>nova-3-medical</code> use the same param. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/model' },
  // Flux first. The Nova toggle carries a picker for the five /v1/listen models.
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: FLUX_MODEL },
      note: 'Flux runs on /v2/listen and writes capitals and punctuation on its own.',
    },
    {
      id: 'nova',
      label: 'Nova',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova models run on /v1/listen; nova-3 is the newest. With no other params they write lowercase words with no punctuation.',
    },
  ],
  // Live mic only. Runs stay side by side so the same line can be read on two models.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { nova: 'nova-3' },
  variants: NOVA_MODELS.map((nova) => ({ nova })),

  // The model is the feature, so it is sent from here on both endpoints and marked on the card.
  params: (state, { model }): Params => ({ model: modelFor(state, model.endpoint) }),
  highlight: ['model'],

  runLabel: (state, { model }) => modelFor(state, model.endpoint),
  compareTip: (_, { model }) =>
    onFlux(model.endpoint)
      ? 'Flip to Nova, pick a model, and read the same line again.'
      : 'Pick another model, or flip to Flux, and read the same line again.',

  phrases: () => ['Dr. Okonkwo moved the Kubernetes rollout to March 3rd. Send $42 to Siobhan.'],

  echo(msg): Echo | undefined {
    const transcript = finalTranscript(msg)
    if (!transcript) return undefined
    const info = (msg.metadata as Json | undefined)?.model_info as Json | undefined
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
    return { name: str(info?.name), version: str(info?.version), transcript }
  },

  Controls({ state, setState, ctx }) {
    if (onFlux(ctx.model.endpoint)) {
      return (
        <div className="field model-field">
          <span className="model-field__label">
            model=<code>{FLUX_MODEL}</code>
          </span>
        </div>
      )
    }
    return (
      <div className="field model-field">
        <span className="model-field__label">Nova model</span>
        <div className="segmented" role="radiogroup" aria-label="Nova model">
          {NOVA_MODELS.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={state.nova === m}
              className={state.nova === m ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => setState({ nova: m })}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as Echo | undefined
    if (!e) return <span className="wire__key">The last final transcript shows up here after a run.</span>
    return (
      <span className="wire__part wire__part--text">
        {e.name && (
          <>
            <span className="wire__key">"model_info":</span> {'{ '}
            <mark>"name": {JSON.stringify(e.name)}</mark>, "version": {JSON.stringify(e.version ?? '')}
            {' }'},{' '}
          </>
        )}
        <span className="wire__key">"transcript":</span> {JSON.stringify(e.transcript)}
      </span>
    )
  },

  Result({ run, live }) {
    return (
      <PlainTranscript
        committed={run?.committed ?? []}
        pending={run?.pending ?? []}
        live={live}
        emptyText="Your transcript shows up here. Read the line, then switch models and read it again."
      />
    )
  },
})
