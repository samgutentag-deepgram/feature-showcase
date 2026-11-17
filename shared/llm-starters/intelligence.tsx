// Starter for an Audio / Text Intelligence demo (`bash scripts/new.sh <id> llm`). Rewrite it for
// your feature, then replace this comment with what you verified live and when.
// The same params go to /v1/read (typed text) and /v1/listen (the mic, recorded then sent once).
import { defineLlmFeature } from '../../shared/llm/feature'

interface State {
  topics: boolean
}

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'intelligence',
  copy: {
    headline: 'Is this customer happy?',
    lede: 'Say a sentence or type one. Deepgram tags each part positive, neutral, or negative, with a score from -1 to 1.',
    ctaTitle: 'Add sentiment=true to your next request.',
    ctaBody: (
      <>
        <code>sentiment</code> works on <code>/v1/listen</code> (pre-recorded audio) and <code>/v1/read</code> (text), in
        English. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/sentiment-analysis' },
  // Mic first; typing is the natural input for /v1/read.
  inputs: [
    { id: 'mic', label: 'Speak', source: 'mic' },
    { id: 'text', label: 'Type', source: 'text' },
  ],
  initialState: { topics: false },
  variants: [{ topics: false }, { topics: true }],
  params: ({ topics }) => ({ sentiment: 'true', ...(topics ? { topics: 'true' } : {}) }),
  highlight: ['sentiment', 'topics'],
  runLabel: ({ topics }) => (topics ? 'sentiment and topics' : 'sentiment'),
  texts: () => [
    'I love the new phone, the camera is amazing. But the battery dies by noon and support never called me back.',
    'Thanks so much, that fixed it on the first try.',
  ],
  phrases: () => ['I love the new phone, the camera is amazing. But the battery dies by noon and support never called me back.'],
  Controls({ state, setState, busy }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.topics} disabled={busy} onChange={(e) => setState({ topics: e.target.checked })} />
        Also detect topics
      </label>
    )
  },
})
