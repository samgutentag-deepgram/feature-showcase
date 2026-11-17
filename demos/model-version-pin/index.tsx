// version on Nova-3: pin the model build a request runs on, and see which build Deepgram says ran.
// Checked 2026-11-16 on /v1/listen streaming: version=latest ran general-nova-3 2025-04-17.21547
// (uuid 40bd3654-e622-47c4-a111-63a61b23bfe8); version=2025-01-09.0 ran general-nova-3 2025-01-09.0
// (uuid bf05427e-a1f1-4ced-a976-38b2f3533d8d). Every Results message carries the same
// metadata.model_info and model_uuid as the Metadata message. /v2/listen with version is a 400
// ("Unknown query parameters: version"). 2025-02-22.5738 and 2026-01-27.9249 are 400s for English
// ("No such model/language/version/tier combination").
// Pre-recorded also takes it: version=2024-12-20.0 ran general-nova-3 2024-12-20.0.
// Verified live 2026-11-16: pnpm verify:live opened /v1/listen?model=nova-3&version=latest and
// &version=2025-01-09.0 and the prompt URL, all accepted; by hand, latest reported general-nova-3
// 2025-04-17.21547 and the pin reported 2025-01-09.0 (uuid bf05427e-a1f1-4ced-a976-38b2f3533d8d).
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'

// latest, and the oldest Nova-3 English streaming build /v1/models lists, both accepted live.
export const VERSIONS = ['latest', '2025-01-09.0'] as const
export type Version = (typeof VERSIONS)[number]

interface State {
  version: Version
}

export interface Reported {
  name: string
  version: string
  uuid: string
  transcript?: string
}

// What Deepgram says ran, from a final Results message's metadata. Undefined for anything else.
export function reported(msg: Json): Reported | undefined {
  if (msg.type !== 'Results' || msg.is_final !== true) return undefined
  const meta = msg.metadata as Json | undefined
  const info = meta?.model_info as Json | undefined
  if (!info || typeof meta?.model_uuid !== 'string') return undefined
  return {
    name: String(info.name ?? ''),
    version: String(info.version ?? ''),
    uuid: meta.model_uuid,
    transcript: finalTranscript(msg),
  }
}

const LABEL: Record<Version, string> = { latest: 'latest', '2025-01-09.0': 'Pinned: 2025-01-09.0' }

export default defineFeature<State>({
  copy: {
    headline: 'Which Nova-3 just wrote that down?',
    lede: 'Run the phrase on version=latest, then pin an earlier Nova-3 build, 2025-01-09.0, and run it again. The Response card shows the version and model uuid Deepgram reports back for each run.',
    ctaTitle: 'Pin version in your next request.',
    ctaBody: (
      <>
        <code>version</code> holds a request to one model build on <code>/v1/listen</code>, streaming and
        pre-recorded, so an upgrade only happens when you choose it. Every response says which build ran in{' '}
        <code>model_info</code>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/version' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support version yet (/v2/listen answers it with a 400).',
    },
  ],
  // Live mic only. Runs stay side by side so latest and the pinned build can be compared.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { version: 'latest' },
  variants: VERSIONS.map((version) => ({ version })),

  // Sent either way, so the Request card always says which build was asked for.
  params: ({ version }): Params => ({ version }),
  highlight: ['version'],

  runLabel: ({ version }) => `version=${version}`,
  actionLabel: ({ version }) => `Run with version=${version}`,
  compareTip: ({ version }) =>
    version === 'latest' ? 'Pin 2025-01-09.0 and run it again to compare.' : 'Switch back to latest and run it again to compare.',

  phrases: () => ['Same words, two model versions. Which one heard me better?'],

  echo: (msg) => reported(msg),

  Controls({ state, setState, ctx }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="Model version">
        {VERSIONS.map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={state.version === v}
            className={state.version === v ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={ctx.busy}
            onClick={() => setState({ version: v })}
          >
            {LABEL[v]}
          </button>
        ))}
      </div>
    )
  },

  Response({ latest }) {
    const r = latest?.echoed as Reported | undefined
    if (!r) {
      return <span className="wire__key">The model version and uuid Deepgram reports show up here after a run.</span>
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"model_info":</span> {'{ "name": '}
        {JSON.stringify(r.name)}, <mark>"version": {JSON.stringify(r.version)}</mark>
        {' }'}, <span className="wire__key">"model_uuid":</span> <mark>{JSON.stringify(r.uuid)}</mark>
      </span>
    )
  },

  Result({ run, live }) {
    const r = run?.echoed as Reported | undefined
    return (
      <>
        <PlainTranscript
          committed={run?.committed ?? []}
          pending={run?.pending ?? []}
          live={live}
          emptyText="Your transcript shows up here, with the model version that wrote it."
        />
        {r && (
          <p className="note">
            Ran on {r.name} {r.version}
          </p>
        )}
      </>
    )
  },
})
