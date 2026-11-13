// Turns on the Flux socket, and what the server says about each. Verified live 2026-11-12 on wss
// /v2/speak with flux-wes-en, linear16 at 24 kHz: each Speak + Flush is a turn of its own,
// answered SpeechStarted {speech_id}, Flushed, the audio, then SpeechMetadata {speech_id,
// audio_duration_ms, input_character_count, billable_character_count}. A new turn gets a new
// speech_id; the voice keeps its tone across turns on one socket (docs/flux-tts/context).
// Flux only. flux-wes-en is the default: the steadiest of 14 English Flux voices on 2026-11-11.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_SESSION } from '../../shared/tts/voices'

interface State {
  line: string
}

const LINES = [
  { name: 'Support', detail: '4 turns', value: 'support' },
  { name: 'Booking', detail: '4 turns', value: 'booking' },
  { name: 'Order', detail: '3 turns', value: 'order' },
]
const TEXT: Record<string, string> = {
  support: 'Thanks for calling Acme support. I can see your order right here. It shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with?',
  booking: 'Sure, let me check that for you. I have a table for four at seven thirty. Would you like me to book it? I will send the confirmation to your phone.',
  order: 'Got it, one large pepperoni and a side salad. Your total comes to twenty four dollars. It will be ready for pickup in about twenty minutes.',
}

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Every turn, accounted for.',
    lede: 'A voice agent speaks in turns. Press Speak and the page sends the reply one sentence per turn on a single Flux socket. Each turn comes back with its own speech_id, how long the audio ran, and how many characters were billed.',
    ctaTitle: 'Know what every turn cost.',
    ctaBody: (
      <>
        On the Flux socket at <code>/v2/speak</code>, end each turn with <code>Flush</code>. Flux answers{' '}
        <code>SpeechStarted</code> with a <code>speech_id</code>, then <code>SpeechMetadata</code> with{' '}
        <code>audio_duration_ms</code> and <code>billable_character_count</code>. New accounts start with $200 in
        free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux-tts/state' },
  voices: FLUX_SESSION,
  initialState: { line: 'support' },
  variants: [{ line: 'support' }],
  params: () => ({ encoding: 'linear16', sample_rate: '24000', container: 'none' }),
  highlight: [],
  session: { split: 'sentence' },
  restartOnPick: true,
  textFor: ({ line }) => TEXT[line],
  runLabel: ({ line }) => `${LINES.find((l) => l.value === line)?.name ?? line} reply`,
  phrases: [TEXT.support],

  Controls({ state, setState }) {
    return <Steps label="Reply" steps={LINES} value={state.line} onPick={(line) => setState({ line })} />
  },
})
