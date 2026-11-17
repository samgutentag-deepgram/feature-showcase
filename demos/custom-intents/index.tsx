// Custom intents: the visitor types intents of their own and picks custom_intent_mode. strict returns
// only intents from that list; extended adds intents Deepgram names itself. The same params go to
// /v1/read (typed text) and /v1/listen (the mic, recorded then sent once).
// Verified live 2026-11-16: pnpm verify:live sent both modes on /v1/read and /v1/listen (Aura-2 audio), all 200 with intents. By curl, the default text and list: strict returned only "update payment method" (0.74, 0.21); extended returned it plus Deepgram's own package intent ("Request information about package location" and similar, three of three). "speak to a manager", absent from the text, never came back. Unlike custom topics, strict was not empty for a text with none of the listed intents: it named "update payment method" at 0.20.
import { analysis, type Segment } from '../../shared/llm/request'
import type { LlmRun } from '../../shared/llm/feature'
import { defineLlmFeature } from '../../shared/llm/feature'
import './styles.css'

type Mode = 'strict' | 'extended'

interface State {
  // Comma-separated, as typed.
  intents: string
  mode: Mode
}

const DEFAULT_INTENTS = 'cancel subscription, update payment method, speak to a manager'
const TEXT = 'My card expired, so I need to update my payment method. Also, can you tell me where my package is?'

const parseIntents = (s: string) =>
  s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: 'strict', label: 'Strict', note: 'Only intents from your list come back.' },
  { id: 'extended', label: 'Extended', note: 'Your intents, plus any Deepgram names on its own.' },
]

const pct = (n: number) => `${Math.round(n * 100)}%`
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// Each segment's intents, yours marked apart from the ones Deepgram named itself.
function IntentSegments({ segments, mine }: { segments: Segment[]; mine: string[] }) {
  if (!segments.length) return <p className="llm-said llm-said--muted">No intents came back for this text.</p>
  return (
    <ul className="llm-segments">
      {segments.map((s, i) => (
        <li key={i}>
          <span className="llm-segments__text">{s.text}</span>
          <span className="llm-tags">
            {s.intents?.map((t, j) => {
              const yours = mine.some((m) => same(m, t.intent))
              return (
                <span className={yours ? 'llm-tag llm-tag--accent' : 'llm-tag'} key={j}>
                  {t.intent} {pct(t.confidence_score)}
                  {yours ? '' : ', Deepgram’s own'}
                </span>
              )
            })}
          </span>
        </li>
      ))}
    </ul>
  )
}

function IntentResult({ run }: { run?: LlmRun<State> }) {
  if (!run) return <p className="llm-said llm-said--muted">Your result shows up here.</p>
  const lane = run.lanes[0]
  const a = analysis(lane?.exchanges.at(-1)?.json)
  const mine = parseIntents(run.state.intents)
  const found = new Set((a.intents ?? []).flatMap((s) => s.intents ?? []).map((t) => t.intent.toLowerCase()))
  const back = mine.filter((m) => found.has(m.toLowerCase()))
  const missing = mine.filter((m) => !found.has(m.toLowerCase()))
  return (
    <div className="llm-run">
      <div>
        <h3 className="llm-section__title">{a.transcript !== undefined ? 'Transcript' : 'Text sent'}</h3>
        <p className="llm-said">{a.transcript ?? run.text}</p>
      </div>
      {lane?.status === 'running' && <p className="llm-said llm-said--muted">Waiting for Deepgram…</p>}
      {lane?.error && <p className="error">{lane.error}</p>}
      {a.intents && (
        <>
          <div>
            <h3 className="llm-section__title">Intents, {run.state.mode}</h3>
            <IntentSegments segments={a.intents} mine={mine} />
          </div>
          <dl className="llm-stats">
            <dt>yours, back</dt>
            <dd>{back.length ? back.join(', ') : 'none'}</dd>
            <dt>yours, not back</dt>
            <dd>{missing.length ? missing.join(', ') : 'none'}</dd>
          </dl>
        </>
      )}
    </div>
  )
}

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'intelligence',
  copy: {
    headline: 'Does the caller want one of your intents?',
    lede: 'List the intents your app acts on, then speak or type. Strict returns only intents from your list. Extended also returns the ones Deepgram names on its own.',
    ctaTitle: 'Send custom_intent with intents=true on your next request.',
    ctaBody: (
      <>
        Repeat <code>custom_intent</code> for each intent (up to 100) and set <code>custom_intent_mode</code> to{' '}
        <code>strict</code> or <code>extended</code>. It works on <code>/v1/listen</code> (pre-recorded audio) and{' '}
        <code>/v1/read</code> (text), in English. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/intent-recognition' },
  // Mic first; typing is the natural input for /v1/read.
  inputs: [
    { id: 'mic', label: 'Speak', source: 'mic' },
    { id: 'text', label: 'Type', source: 'text' },
  ],
  initialState: { intents: DEFAULT_INTENTS, mode: 'strict' },
  variants: [
    { intents: DEFAULT_INTENTS, mode: 'strict' },
    { intents: DEFAULT_INTENTS, mode: 'extended' },
  ],
  // Strict next to extended on the same text is the point.
  compare: true,
  // intents=true is required: custom_intent alone is a 400 ("Request did not enable any features").
  params: ({ intents, mode }) => {
    const list = parseIntents(intents)
    return { intents: 'true', ...(list.length ? { custom_intent: list } : {}), custom_intent_mode: mode }
  },
  highlight: ['custom_intent', 'custom_intent_mode'],
  runLabel: ({ mode }) => `custom intents, ${mode}`,
  texts: () => [TEXT, 'Please cancel my subscription, I do not use it anymore.'],
  phrases: () => [TEXT],
  Result: ({ run }) => <IntentResult run={run} />,
  Controls({ state, setState, busy }) {
    return (
      <div className="field ci-field">
        <label className="llm-text__label" htmlFor="ci-intents">
          Your intents, separated by commas
        </label>
        <input
          id="ci-intents"
          className="ci-input"
          type="text"
          value={state.intents}
          disabled={busy}
          onChange={(e) => setState({ ...state, intents: e.target.value })}
        />
        <div className="segmented" role="radiogroup" aria-label="custom_intent_mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={state.mode === m.id}
              className={state.mode === m.id ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ ...state, mode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="hint">{MODES.find((m) => m.id === state.mode)?.note} Scores vary from run to run.</p>
      </div>
    )
  },
})
