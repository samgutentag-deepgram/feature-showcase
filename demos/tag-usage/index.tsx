// tag on Flux and Nova-3: label a request so usage reports can filter by it. The transcript does
// not change, and neither socket echoes the tag in its transcript messages, so the page shows the
// tags on the Request card and the request_id they are filed under on the Response card.
// Checked 2026-11-16 with tag=showcase-flux&tag=tag-usage-test (and the Nova-3 equivalent):
// /v2/listen flux-general-en opens and sends no tags in any message; /v1/listen nova-3 puts
// "tags": [...] only in the Metadata message at the close (not in Results.metadata); pre-recorded
// /v1/listen returns metadata.tags. GET /v1/projects/<id>/requests/<request_id> lists the tags
// under response.details.tags for all three requests.
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'

type Team = 'support' | 'sales'

interface State {
  team: Team
  // Add a second tag, to show the param repeated.
  env: boolean
}

// Fixed tags only. A free-text field would let visitors fill the project's 500 unique tags a day.
export const TEAMS: Team[] = ['support', 'sales']
export const ENV_TAG = 'env-demo'

export const tagsFor = ({ team, env }: State): string[] => (env ? [`team-${team}`, ENV_TAG] : [`team-${team}`])

// Flux sends request_id at the top of every message; Nova-3 sends it in each Results' metadata.
export function requestId(msg: Json): string | undefined {
  if (typeof msg.request_id === 'string') return msg.request_id
  const meta = msg.metadata as Json | undefined
  return typeof meta?.request_id === 'string' ? meta.request_id : undefined
}

export default defineFeature<State>({
  copy: {
    headline: 'Which team ran this request?',
    lede: 'A tag rides along with the request and lands in your usage reports, not in the transcript. Pick a team, read the line, and see the tag on the request and the request_id it is filed under.',
    ctaTitle: 'Add tag to your next request.',
    ctaBody: (
      <>
        <code>tag</code> labels a request so <code>{'GET /v1/projects/{project_id}/requests'}</code> and{' '}
        <code>/usage?tag=</code> can find it later. Repeat it for more than one tag, up to 128 characters each. Flux
        and Nova-3 both take it. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/stt-tagging' },
  // Flux first: /v2/listen takes tag and files it with the request.
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'Flux files the tag with the request. Its socket messages do not echo it back.',
    },
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 files the tag with the request. Its Results messages do not echo it; the Metadata message at the close does.',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic' }],
  initialState: { team: 'support', env: false },
  variants: [
    { team: 'support', env: false },
    { team: 'sales', env: false },
    { team: 'support', env: true },
    { team: 'sales', env: true },
  ],

  params: (state): Params => {
    const tags = tagsFor(state)
    return { tag: tags.length === 1 ? tags[0] : tags }
  },
  highlight: ['tag'],

  runLabel: (state) => tagsFor(state).map((t) => `tag=${t}`).join('&'),

  phrases: ({ team }) => [`Hi, this call is for the ${team} team. Please file it under ${team}.`],

  echo: (msg) => requestId(msg),

  Controls({ state, setState, ctx }) {
    return (
      <>
        <div className="segmented" role="radiogroup" aria-label="Team tag">
          {TEAMS.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={state.team === t}
              className={state.team === t ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => setState({ ...state, team: t })}
            >
              team-{t}
            </button>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={state.env}
            disabled={ctx.busy}
            onChange={(e) => setState({ ...state, env: e.target.checked })}
          />
          Add a second tag, <code>{ENV_TAG}</code>
        </label>
      </>
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
            {'The tags are not in the transcript. In your own project, GET /v1/projects/{project_id}/requests/{request_id} lists them under response.details.tags.'}
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
        emptyText="Your transcript shows up here, the same with or without a tag."
      />
    )
  },
})
