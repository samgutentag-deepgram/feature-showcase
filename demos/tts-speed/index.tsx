// Speaking rate. Verified live 2026-11-12, linear16 at 24 kHz, container=none:
//   POST /v2/speak flux-wes-en       speed 0.5-1.5 is a 200; 0.4 and 1.6 are a 400 "'speed' must be
//                                    between 0.5 and 1.5". A 96-character line: 0.7 -> 8.72 s,
//                                    1.0 -> 5.04 s, 1.5 -> 3.60 s.
//   POST /v1/speak aura-2-thalia-en  speed 0.7-1.5 is a 200; 0.5, 0.65 and 1.55 are a 400 "'speed'
//                                    must be within documented range". 0.7 -> 9.40 s, 1.0 -> 5.00 s.
// So the buttons run 0.7 to 1.5, which every voice in the picker takes. Picking one stops the
// line and speaks it again at that speed. (On the Flux socket, {"type":"Configure","speed":0.75}
// between turns changes it without reconnecting: ConfigureSuccess, checked the same day.)
// Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
// same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
// spread (0.08 s) of 14 Flux voices tried.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_THEN_AURA } from '../../shared/tts/voices'

interface State {
  speed: string
}

const STEPS = [
  { name: 'Slowest', detail: '0.7x', value: '0.7' },
  { name: 'Slower', detail: '0.85x', value: '0.85' },
  { name: 'Normal', detail: '1.0x', value: '1.0' },
  { name: 'Faster', detail: '1.25x', value: '1.25' },
  { name: 'Fastest', detail: '1.5x', value: '1.5' },
]

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Slow down for the numbers.',
    lede: 'Press Speak, then pick a speed any time: the line starts over at that pace. Slow it down for a confirmation number someone has to write down, speed it up for the disclaimer nobody wants to sit through. Same voice, same words.',
    ctaTitle: 'Set the pace per line, not per voice.',
    ctaBody: (
      <>
        Add <code>speed</code> to the request: 0.5 to 1.5 on Flux voices at <code>/v2/speak</code>, 0.7 to 1.5
        on Aura-2 at <code>/v1/speak</code>. Same voice, no re-recording. New accounts start with $200 in
        free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-voice-controls' },
  voices: FLUX_THEN_AURA,
  initialState: { speed: '1.0' },
  variants: STEPS.map(({ value }) => ({ speed: value })),
  promptState: { speed: '0.85' },
  params: ({ speed }) => ({ encoding: 'linear16', sample_rate: '24000', container: 'none', speed }),
  highlight: ['speed'],
  restartOnPick: true,
  runLabel: ({ speed }) => `speed=${speed}`,
  phrases: [
    'Your confirmation number is 4 7 2 9 1 8. Again, that is 4 7 2 9 1 8. In a minute, we will text you the same number, so keep it handy, in case you call us back.',
    'This call may be recorded, for quality and training purposes. Message and data rates may apply. This offer is for new customers only, terms and conditions apply, and the details are on our website.',
    'Take one tablet twice a day, with food, and never on an empty stomach. If you feel dizzy, sit down, and drink some water. If the dizziness lasts more than a day, call your doctor.',
  ],

  Controls({ state, setState, busy }) {
    return <Steps label="Speed" steps={STEPS} value={state.speed} onPick={(speed) => setState({ speed })} disabled={busy} />
  },
})
