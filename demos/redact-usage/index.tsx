// redact_usage on Flux and Nova-3: Deepgram stores [REDACTED] in its usage record in place of the
// text you passed in keyterm (and keywords, replace, search, extra, custom_topic, custom_intent).
// The transcript and every socket message are the same either way, so the page shows the param on
// the Request card, the request_id on the Response card, and what the record for that request
// stores, which you read back with the Management API.
// Checked 2026-11-16 with a 1 s macOS say clip ("Call Jane Doe at Acme.") and
// keyterm=Acme&keyterm=Jane%20Doe, then GET /v1/projects/<id>/requests/<request_id> for each:
//   pre-recorded /v1/listen nova-3, redact_usage=false: path keeps keyterm=Acme&keyterm=Jane+Doe.
//   pre-recorded, streaming /v1/listen nova-3, and /v2/listen flux-general-en, redact_usage=true:
//   path reads keyterm=%5BREDACTED%5D&keyterm=%5BREDACTED%5D&redact_usage=%5BREDACTED%5D.
//   Transcripts match with and without it. response.details.features still lists "keyterm".
//   Flux Configure {"redact_usage": true, "keyterms": [...]} gets a ConfigureSuccess echoing
//   "redact_usage": true; the URL's keyterm=Acme stays visible in the record, as the docs say.
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'

interface State {
  on: boolean
}

// Fixed keyterms, not a text field: the page should not invite visitors to type real names.
export const KEYTERMS = ['Jane Doe', 'Acme']
export const DOCS = 'https://developers.deepgram.com/docs/redact-usage'

// Flux sends request_id at the top of every message; Nova-3 sends it in each Results' metadata.
export function requestId(msg: Json): string | undefined {
  if (typeof msg.request_id === 'string') return msg.request_id
  const meta = msg.metadata as Json | undefined
  return typeof meta?.request_id === 'string' ? meta.request_id : undefined
}

// What the usage record's path stores for the feature params, as the Management API returned it
// (space as +, brackets percent-encoded). Checked live; this page never calls that API.
export function recordedQuery(on: boolean): string {
  const terms = KEYTERMS.map((t) => `keyterm=${on ? '%5BREDACTED%5D' : t.replace(/ /g, '+')}`)
  return [...terms, `redact_usage=${on ? '%5BREDACTED%5D' : 'false'}`].join('&')
}

export default defineFeature<State>({
  copy: {
    headline: 'Keep keyterms out of your usage logs.',
    lede: 'Deepgram records the parameters of every request. Read the line with redact_usage off, then on: the transcript is the same, but the usage record for the second request stores [REDACTED] where your keyterms were.',
    ctaTitle: 'Add redact_usage=true to requests that carry sensitive keyterms.',
    ctaBody: (
      <>
        <code>redact_usage</code> works on Flux and Nova-3, streaming and pre-recorded. It redacts{' '}
        <code>keyterm</code>, <code>keywords</code>, <code>replace</code>, <code>search</code>, <code>extra</code>,{' '}
        <code>custom_topic</code>, and <code>custom_intent</code>, not <code>tag</code> or <code>callback</code>. Read
        the record back with <code>{'GET /v1/projects/{project_id}/requests/{request_id}'}</code>. New accounts start
        with $200 in free credit.
      </>
    ),
  },
  links: { docs: DOCS },
  // Flux first: /v2/listen takes redact_usage and redacts its keyterms in the record.
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux stores [REDACTED] for each keyterm on the URL. Its socket messages are the same either way.',
    },
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 stores [REDACTED] for each keyterm on the URL. Its Results messages are the same either way.',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // Sent either way, so the Request card always says which one ran.
  params: ({ on }): Params => ({ keyterm: KEYTERMS, redact_usage: String(on) }),
  highlight: ['redact_usage'],

  runLabel: ({ on }) => `redact_usage=${on}`,
  actionLabel: ({ on }) => `Run with redact_usage=${on}`,
  compareTip: ({ on }) =>
    on ? 'Turn redact_usage off and read it again to compare.' : 'Turn redact_usage on and read it again to compare.',

  phrases: () => ['Please call Jane Doe at Acme about the invoice.'],

  echo: (msg) => requestId(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.on} disabled={ctx.busy} onChange={(e) => setState({ on: e.target.checked })} />
        Redact keyterms in the usage record
      </label>
    )
  },

  Response({ latest }) {
    if (typeof latest?.echoed !== 'string') {
      return <span className="wire__key">The request_id shows up here once Deepgram answers.</span>
    }
    return (
      <>
        <span className="wire__part">
          <span className="wire__key">"request_id":</span> <mark>{JSON.stringify(latest.echoed)}</mark>
        </span>
        <br />
        <span className="wire__part wire__part--text">
          <span className="wire__key">
            {`The response is the same either way. In your own project, GET /v1/projects/{project_id}/requests/{request_id} returns a path that includes ${recordedQuery(latest.state.on)}`}
          </span>
        </span>
      </>
    )
  },

  Result({ run, live }) {
    return (
      <PlainTranscript
        committed={run?.committed ?? []}
        pending={run?.pending ?? []}
        live={live}
        emptyText="Your transcript shows up here, the same with or without redact_usage."
      />
    )
  },
})
