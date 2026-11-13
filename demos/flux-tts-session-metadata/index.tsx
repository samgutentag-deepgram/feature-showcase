// What a whole Flux socket session cost, reported once at the end. Verified live 2026-11-13 on wss
// /v2/speak, linear16 at 24 kHz, with flux-wes-en (3 and 4 turns) and flux-hannah-en (3 turns):
//   after the last turn's SpeechMetadata, {"type":"Close"} -> SessionMetadata in 24-80 ms, then a
//   1000 close. Its fields: type, total_audio_duration_ms, total_input_character_count,
//   total_billable_character_count. Nothing else.
//   wes, 3 turns of 19 + 32 + 29 chars -> {4800, 80, 80}; turns 1120 + 1600 + 2080 ms = 4800.
//   wes, 4 turns with trailing spaces, 147 chars -> {7440, 147, 147}; the spaces are counted.
//   hannah, 3 turns, 139 chars -> {8480, 139, 139}; turns 3840 + 2000 + 2640 ms = 8480.
//   Every total matched the sum of the turns and the characters sent; input and billable were equal.
//   Closing the socket without Close: no SessionMetadata. Speak + Close with no Flush: the session
//   still reported, but with 2.48 s of audio where Speak + Flush + Close gave 4.4 s.
// Flux only: SessionMetadata is a /v2/speak message. flux-wes-en is the default: the steadiest of 14
// English Flux voices on 2026-11-11.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_SESSION } from '../../shared/tts/voices'

interface State {
  line: string
}

const LINES = [
  { name: 'Greeting', detail: '2 turns', value: 'greeting' },
  { name: 'Order', detail: '3 turns', value: 'order' },
  { name: 'Support', detail: '5 turns', value: 'support' },
]
const TEXT: Record<string, string> = {
  greeting: 'Thanks for calling Acme. How can I help you today?',
  order: 'Got it, one large pepperoni and a side salad. Your total comes to twenty four dollars. It will be ready for pickup in about twenty minutes.',
  support: 'I can see your order right here. It shipped this morning from our Denver warehouse. The tracking number is on its way to your phone. It should arrive by Thursday afternoon. Is there anything else I can help you with?',
}

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'One bill for the whole call.',
    lede: 'Press Speak and the reply goes out a sentence per turn on one Flux socket. When the last turn is done, the page sends Close, and Flux answers with SessionMetadata: the total audio and billable characters for the whole session, set against the sum of the turns. Flux voices only.',
    ctaTitle: 'Totals in one message.',
    ctaBody: (
      <>
        On the Flux socket at <code>/v2/speak</code>, send <code>{'{"type":"Close"}'}</code> when the conversation
        ends. Flux answers <code>SessionMetadata</code> with <code>total_audio_duration_ms</code> and{' '}
        <code>total_billable_character_count</code>, then closes the socket. New accounts start with $200 in free
        credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux-tts/server-messages' },
  voices: FLUX_SESSION,
  initialState: { line: 'order' },
  variants: LINES.map(({ value }) => ({ line: value })),
  promptState: { line: 'order' },
  params: () => ({ encoding: 'linear16', sample_rate: '24000', container: 'none' }),
  highlight: [],
  session: { split: 'sentence' },
  close: {},
  restartOnPick: true,
  textFor: ({ line }) => TEXT[line],
  runLabel: ({ line }) => `${LINES.find((l) => l.value === line)?.name ?? line} reply`,
  phrases: [TEXT.order, TEXT.greeting, TEXT.support],

  Controls({ state, setState }) {
    return <Steps label="Reply" steps={LINES} value={state.line} onPick={(line) => setState({ line })} />
  },
})
