// Change the speaking speed mid-session, without reconnecting. Verified live 2026-11-12 on wss
// /v2/speak with flux-wes-en, linear16 at 24 kHz:
//   {"type":"Configure","speed":0.5} between turns -> ConfigureSuccess {"applied":{"speed":0.5}},
//   and the next turn obeys it: the same sentence took 5.04 s at 1.0, 12.8 s at 0.5, 4.0 s at 1.5.
//   speed 2.0 -> ConfigureFailure SPEED_OUT_OF_RANGE ("between 0.5 and 1.5"); 1.17 ->
//   SPEED_INCREMENT_INVALID ("increments of 0.05").
//   Configure sent while a turn's text was already all in got no answer and changed nothing, so
//   the page sends the line a phrase per turn. A pick restarts the line at the new speed (Sam's call
//   for this demo), with Configure sent before the first turn.
// Flux only: Aura-2's socket on /v1/speak has no Configure. flux-wes-en is the default: the
// steadiest of 14 English Flux voices on 2026-11-11.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_SESSION } from '../../shared/tts/voices'

interface State {
  speed: string
}

const STEPS = [
  { name: 'Slowest', detail: '0.5x', value: '0.5' },
  { name: 'Slower', detail: '0.75x', value: '0.75' },
  { name: 'Normal', detail: '1.0x', value: '1.0' },
  { name: 'Faster', detail: '1.25x', value: '1.25' },
  { name: 'Fastest', detail: '1.5x', value: '1.5' },
]

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Change the pace without hanging up.',
    lede: 'Pick a speed and the line starts over at it. On the Flux socket, speed is a Configure message, not part of the URL: the page sends it before the first turn, and Flux confirms it with ConfigureSuccess. In a live conversation you send the same message between turns, with no reconnect.',
    ctaTitle: 'One socket, any speed.',
    ctaBody: (
      <>
        On the Flux socket at <code>/v2/speak</code>, send <code>{'{"type":"Configure","speed":0.75}'}</code>{' '}
        between turns: 0.5 to 1.5, in steps of 0.05. Flux answers <code>ConfigureSuccess</code> and the next turn
        uses it. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux-tts/client-messages' },
  voices: FLUX_SESSION,
  initialState: { speed: '1.0' },
  variants: [{ speed: '0.5' }, { speed: '1.0' }, { speed: '1.5' }],
  promptState: { speed: '0.75' },
  params: () => ({ encoding: 'linear16', sample_rate: '24000', container: 'none' }),
  highlight: [],
  session: { split: 'phrase', configure: ({ speed }) => ({ speed: Number(speed) }) },
  restartOnPick: true,
  runLabel: ({ speed }) => `speed ${speed}`,
  phrases: [
    'Your confirmation number is 4 7 2 9 1 8. Again, that is 4 7 2 9 1 8. In a minute, we will text you the same number, so keep it handy, in case you call us back. Your appointment is on Tuesday, at ten thirty in the morning, with Doctor Patel.',
    'This call may be recorded, for quality and training purposes. Message and data rates may apply. This offer is for new customers only, terms and conditions apply, and the details are on our website.',
  ],

  Controls({ state, setState }) {
    return <Steps label="Speed" steps={STEPS} value={state.speed} onPick={(speed) => setState({ speed })} />
  },
})
