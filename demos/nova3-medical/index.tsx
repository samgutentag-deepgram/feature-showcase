// model=nova-3-medical beside plain nova-3: the same drug names and doses, read twice.
// Both are Nova-3 models on /v1/listen, so the page has one model entry and the model param is the
// setting. Flux has no medical model: /v2/listen?model=nova-3-medical is a 400 at the handshake
// ("Invalid tier 'nova'", checked 2026-11-16).
// Checked 2026-11-16 on /v1/listen pre-recorded, macOS `say` clip, no other params:
// nova-3-medical gave "patient takes lisinopril ten mg and metformin five hundred mg daily",
// nova-3 gave "the patient takes lisinopril ten mg and metformin five hundred mg daily". Both got
// every drug name right on this synthetic clip; the "listen" mishearing was not reproduced.
import { defineFeature, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'

const MODELS = ['nova-3', 'nova-3-medical'] as const
type MedicalModel = (typeof MODELS)[number]

interface State {
  model: MedicalModel
}

export default defineFeature<State>({
  copy: {
    headline: 'Does your model know lisinopril?',
    lede: 'Read a short medication list out loud. Run it on plain nova-3, then on nova-3-medical, and compare how each writes down the drug names and doses.',
    ctaTitle: 'Set model=nova-3-medical for clinical audio.',
    ctaBody: (
      <>
        <code>nova-3-medical</code> is Nova-3 tuned for audio with medical vocabulary. Swap the <code>model</code> param on <code>/v1/listen</code>, streaming or
        pre-recorded, and keep everything else. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/model' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      // The model param comes from the setting below, so the card shows which one ran.
      params: {},
      note: 'Nova-3 only. Flux does not support a medical model yet (/v2/listen answers model=nova-3-medical with a 400).',
    },
  ],
  // Live mic only. Runs stay side by side so the same phrase can be read on both models.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  // Plain nova-3 first, so the second run is the medical one.
  initialState: { model: 'nova-3' },
  variants: MODELS.map((model) => ({ model })),

  params: ({ model }): Params => ({ model }),
  highlight: ['model'],

  runLabel: ({ model }) => `model=${model}`,
  actionLabel: ({ model }) => `Run with model=${model}`,
  compareTip: ({ model }) =>
    model === 'nova-3-medical'
      ? 'Switch to nova-3 and read it again to compare.'
      : 'Switch to nova-3-medical and read it again to compare.',

  phrases: () => [
    'The patient takes lisinopril 10 milligrams and metformin 500 milligrams daily. Start atorvastatin 40 milligrams, amoxicillin-clavulanate 875 milligrams twice daily, and levothyroxine 50 micrograms.',
  ],

  // The last final transcript Deepgram sent, verbatim.
  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="Model param">
        {MODELS.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={state.model === m}
            className={state.model === m ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={ctx.busy}
            onClick={() => setState({ model: m })}
          >
            {m}
          </button>
        ))}
      </div>
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
        emptyText="Your transcript shows up here. Read the medication list on each model."
      />
    )
  },
})
