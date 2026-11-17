// Intent recognition: intents=true on POST /v1/listen (the mic, recorded then sent once) and POST
// /v1/read (typed text). Deepgram returns the segments where it found intents, each with one or more
// intents phrased as verbs and a confidence from 0 to 1. Plain intents only; custom_intent and
// custom_intent_mode are the custom-intents demo.
// Flux refuses intents at the /v2/listen handshake (400 "Unknown query parameters: intents", checked
// 2026-11-16), so audio goes to Nova-3, recorded and sent once. The Nova-3 streaming socket refuses it
// too (403 at the handshake), though the docs badge says "Streaming: Nova".
import { defineLlmFeature } from '../../shared/llm/feature'

type State = Record<string, never>

const CALL =
  "Hi, I'd like to cancel my premium subscription. Before that, I need to update the credit card on file, since my old card expired. Also, I was charged twice last month, so I want a refund for the extra charge."
const FLIGHT =
  "Hey, my flight to Denver on Friday got canceled. Can you book me on the next flight out? I also need to add a checked bag, and I'd like to know if I can get a hotel voucher for tonight."

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'intelligence',
  copy: {
    headline: 'What does this caller want?',
    lede: 'Read a short call with three asks (cancel a subscription, update a card, get a refund), or type your own. Deepgram returns the intents it found, each phrased as a verb, with a confidence from 0 to 1.',
    ctaTitle: 'Add intents=true to your next request.',
    ctaBody: (
      <>
        <code>intents</code> works on <code>/v1/listen</code> (pre-recorded audio) and <code>/v1/read</code> (text), in
        English. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/intent-recognition' },
  // Mic first; typing is the natural input for /v1/read.
  inputs: [
    { id: 'mic', label: 'Speak', source: 'mic' },
    { id: 'text', label: 'Type', source: 'text' },
  ],
  initialState: {},
  variants: [{}],
  params: () => ({ intents: 'true' }),
  highlight: ['intents'],
  runLabel: () => 'intents',
  texts: () => [CALL, FLIGHT],
  phrases: () => [CALL],
  Controls() {
    return (
      <p className="note">
        Intents are not from a fixed list: Deepgram names them from the text itself. Several asks in a short message can
        come back on one segment, each with its own confidence. To supply your own, add <code>custom_intent</code> and{' '}
        <code>custom_intent_mode</code>, covered on the same docs page.
      </p>
    )
  },
})
