// Topic detection: topics=true on POST /v1/listen (the mic, recorded then sent once) and POST /v1/read
// (typed text). Deepgram splits the text into segments and tags each with one or more topics and a
// confidence from 0 to 1. Plain topics only; custom_topic and custom_topic_mode are the custom-topics demo.
// Flux refuses topics at the /v2/listen handshake (400, checked 2026-11-16), so audio goes to Nova-3.
import { defineLlmFeature } from '../../shared/llm/feature'

type State = Record<string, never>

const CALL =
  "I'm calling about my bill. You charged me twice this month, so I'd like a refund for the duplicate payment. Next, my internet router keeps dropping the connection every evening, and restarting it doesn't help. Last thing, I'm moving to a new apartment on March first, and I need to transfer my service to the new address."
const STANDUP =
  'Quick team update. The marketing budget for next quarter is over by ten thousand dollars, so we need to cut the paid ads. On hiring, we made an offer to a senior backend engineer and she starts in two weeks. Finally, the mobile app launch moves from May to June because the app store review is taking longer.'

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'intelligence',
  copy: {
    headline: 'What was this call about?',
    lede: 'Read a short call that jumps from a billing mistake to a broken router to a move date, or type your own. Deepgram splits it into segments and tags each with the topics it found, with a confidence from 0 to 1.',
    ctaTitle: 'Add topics=true to your next request.',
    ctaBody: (
      <>
        <code>topics</code> works on <code>/v1/listen</code> (pre-recorded audio) and <code>/v1/read</code> (text), in
        English. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/topic-detection' },
  // Mic first; typing is the natural input for /v1/read.
  inputs: [
    { id: 'mic', label: 'Speak', source: 'mic' },
    { id: 'text', label: 'Type', source: 'text' },
  ],
  initialState: {},
  variants: [{}],
  params: () => ({ topics: 'true' }),
  highlight: ['topics'],
  runLabel: () => 'topics',
  texts: () => [CALL, STANDUP],
  phrases: () => [CALL],
  Controls() {
    return (
      <p className="note">
        Topics are not from a fixed list: Deepgram names them from the text itself. To supply your own, add{' '}
        <code>custom_topic</code> and <code>custom_topic_mode</code>, covered on the same topic detection docs page.
      </p>
    )
  },
})
