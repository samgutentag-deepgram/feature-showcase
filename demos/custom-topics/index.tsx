// Custom topics: the visitor's own topics, sent as custom_topic (one per topic) with
// custom_topic_mode=extended or strict, on /v1/listen (recorded mic) and /v1/read (typed text).
// topics=true is required: custom_topic alone is a 400 ("Request did not enable any features").
// Checked by hand 2026-11-16 on /v1/read with "refund, shipping delay, password reset" and the
// router text: extended returned Deepgram's own topics plus "shipping delay" in one segment; strict
// returned only custom topics, at most one, never "password reset" (not in the text), and came back
// with empty segments on some repeats of the same request.
import { defineLlmFeature } from '../../shared/llm/feature'
import { analysis, type Segment } from '../../shared/llm/request'
import type { Params } from '../../shared/common/feature'
import './styles.css'

type Mode = 'extended' | 'strict'

interface State {
  // As typed, comma-separated.
  topics: string
  mode: Mode
}

// The docs' limit per request.
const MAX_TOPICS = 100
const DEFAULT_TOPICS = 'refund, shipping delay, password reset'

const parse = (raw: string) =>
  [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TOPICS)

const ROUTER_TEXT =
  'Hi, I ordered a new router two weeks ago and it still has not arrived. The tracking page says the package is stuck in a warehouse in Ohio. If it does not show up by Friday, I want a full refund to my credit card.'
const PASSWORD_TEXT =
  'I forgot my password and the reset email never came. Can you send it again? I have been locked out of my account since Monday.'
const PHRASE = 'My new router still has not arrived after two weeks. If it is not here by Friday, I want a refund.'

const pct = (n: number) => `${Math.round(n * 100)}%`
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Each typed topic, and the best score it came back with (if it came back at all).
function found(topics: string[], segments: Segment[]) {
  return topics.map((topic) => {
    const scores = segments.flatMap((s) => (s.topics ?? []).filter((t) => same(t.topic, topic)).map((t) => t.confidence_score))
    return { topic, score: scores.length ? Math.max(...scores) : undefined }
  })
}

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'intelligence',
  copy: {
    headline: 'Will Deepgram find your topics?',
    lede: 'Type the topics you care about, then speak or type a support request. Extended returns your topics plus the ones Deepgram finds on its own. Strict returns only yours, and only the ones it finds in the text.',
    ctaTitle: 'Add custom_topic to your next topics=true request.',
    ctaBody: (
      <>
        Send one <code>custom_topic</code> per topic (up to {MAX_TOPICS}) with <code>topics=true</code>, and pick{' '}
        <code>custom_topic_mode=extended</code> or <code>strict</code>. Works on <code>/v1/listen</code> (pre-recorded audio) and{' '}
        <code>/v1/read</code> (text), in English. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/topic-detection' },
  inputs: [
    { id: 'mic', label: 'Speak', source: 'mic' },
    { id: 'text', label: 'Type', source: 'text' },
  ],
  initialState: { topics: DEFAULT_TOPICS, mode: 'extended' },
  variants: [
    { topics: DEFAULT_TOPICS, mode: 'extended' },
    { topics: DEFAULT_TOPICS, mode: 'strict' },
  ],
  compare: true,
  params: ({ topics, mode }): Params => {
    const list = parse(topics)
    return list.length ? { topics: 'true', custom_topic: list, custom_topic_mode: mode } : { topics: 'true' }
  },
  highlight: ['custom_topic', 'custom_topic_mode'],
  runLabel: ({ topics, mode }) => (parse(topics).length ? `${mode}: ${parse(topics).join(', ')}` : 'no custom topics'),
  texts: () => [ROUTER_TEXT, PASSWORD_TEXT],
  phrases: () => [PHRASE],
  Controls({ state, setState, busy }) {
    const count = parse(state.topics).length
    return (
      <div className="field ctopics-field">
        <span className="llm-text__label">Your topics, separated by commas</span>
        <input
          className="ctopics-input"
          type="text"
          aria-label="Your topics, separated by commas"
          value={state.topics}
          disabled={busy}
          onChange={(e) => setState({ ...state, topics: e.target.value })}
        />
        <div className="toolbar">
          <div className="segmented" role="radiogroup" aria-label="custom_topic_mode">
            {(['extended', 'strict'] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={state.mode === m}
                className={state.mode === m ? 'segmented__opt is-on' : 'segmented__opt'}
                disabled={busy}
                onClick={() => setState({ ...state, mode: m })}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="hint">
            {count ? `${count} custom topic${count > 1 ? 's' : ''}` : 'No custom topics: this is plain topics=true'}
          </span>
        </div>
        <p className="note">
          Run it once in each mode: the two runs stay side by side. Strict can come back with no segments at all, even for a
          topic that is in the text. Run it again if that happens.
        </p>
      </div>
    )
  },
  Result({ state, run }) {
    if (!run) return <p className="llm-said llm-said--muted">Your topics, and which ones came back, show up here.</p>
    const lane = run.lanes[0]
    const a = analysis(lane?.exchanges.at(-1)?.json)
    const mine = parse(run.state.topics)
    const segments = a.topics ?? []
    const done = lane?.status === 'done'
    return (
      <div className="llm-run">
        <div>
          <h3 className="llm-section__title">{a.transcript !== undefined ? 'Transcript' : 'Text sent'}</h3>
          <p className="llm-said">{a.transcript ?? run.text}</p>
        </div>
        {lane?.status === 'running' && <p className="llm-said llm-said--muted">Waiting for Deepgram…</p>}
        {lane?.error && <p className="error">{lane.error}</p>}
        {done && (
          <>
            <div>
              <h3 className="llm-section__title">Your topics, {run.state.mode}</h3>
              {mine.length ? (
                <ul className="ctopics-found">
                  {found(mine, segments).map(({ topic, score }) => (
                    <li key={topic} className={score === undefined ? 'ctopics-miss' : 'ctopics-hit'}>
                      <span className={score === undefined ? 'llm-tag' : 'llm-tag llm-tag--accent'}>{topic}</span>
                      {score === undefined ? 'not returned' : `returned, ${pct(score)}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="llm-said llm-said--muted">No custom topics sent.</p>
              )}
            </div>
            <div>
              <h3 className="llm-section__title">Segments ({segments.length})</h3>
              {segments.length ? (
                <ul className="llm-segments">
                  {segments.map((s, i) => (
                    <li key={i}>
                      <span className="llm-segments__text">{s.text}</span>
                      <span className="llm-tags">
                        {s.topics?.map((t) => (
                          <span key={t.topic} className={mine.some((m) => same(m, t.topic)) ? 'llm-tag llm-tag--accent' : 'llm-tag'}>
                            {t.topic} {pct(t.confidence_score)}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="llm-said llm-said--muted">
                  Empty: {'"segments": []'}.{' '}
                  {run.state.mode === 'strict' ? 'Strict found none of your topics this time.' : 'No topics came back.'}
                </p>
              )}
              {segments.length > 0 && <p className="hint">Your topics are filled in; the rest are Deepgram's own.</p>}
            </div>
          </>
        )}
        {state.mode !== run.state.mode && done && <p className="hint">Now in {state.mode} mode: run again to compare.</p>}
      </div>
    )
  },
})
