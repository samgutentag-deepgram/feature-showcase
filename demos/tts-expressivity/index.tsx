// Delivery register, calm to animated, from five buttons. Verified live 2026-11-12 on
// POST /v2/speak, linear16 at 24 kHz, container=none: expressivity -2, -1, 0, 1 and 2 all 200 on
// flux-wes-en, flux-cole-en, flux-meghan-en and flux-drew-en; 3 -> 400 EXPRESSIVITY_OUT_OF_RANGE,
// 1.5 -> 400 EXPRESSIVITY_INCREMENT_INVALID. On wss /v2/speak, expressivity=-2 in the query works too.
// Duration and loudness barely move with it; the difference is pitch range, so judge it by ear.
// Beta, Flux only (docs/tts-expressivity): 0 is the tuned default and the only value Deepgram
// validates for production; larger values can drop or repeat words. The page says so.
// expressivity is set per request (or per socket connection): picking a button stops the line and
// speaks it again with that value.
// flux-wes-en is the default: the steadiest of 14 Flux voices on 2026-11-11.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_STEADY } from '../../shared/tts/voices'

interface State {
  expressivity: string
}

const STEPS = [
  { name: 'Calmest', detail: '-2', value: '-2' },
  { name: 'Calmer', detail: '-1', value: '-1' },
  { name: 'Normal', detail: '0', value: '0' },
  { name: 'Livelier', detail: '1', value: '1' },
  { name: 'Liveliest', detail: '2', value: '2' },
]
const NAMES = Object.fromEntries(STEPS.map((s) => [s.value, s.name]))

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Calm for support, bright for good news.',
    lede: 'Press Speak, then pick a register any time, from calmest to liveliest: the line starts over with it. Same Flux voice, same words. Expressivity is in beta. Normal (0) is the tuned default, and the far ends can drop or repeat a word, so listen before you ship one.',
    ctaTitle: 'Match the voice to the moment.',
    ctaBody: (
      <>
        Add <code>expressivity</code> to a Flux request on <code>/v2/speak</code>: a whole number from -2 (calm)
        to 2 (animated), per request or per socket connection. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-expressivity' },
  voices: FLUX_STEADY,
  initialState: { expressivity: '0' },
  variants: STEPS.map(({ value }) => ({ expressivity: value })),
  promptState: { expressivity: '-1' },
  params: ({ expressivity }) => ({ encoding: 'linear16', sample_rate: '24000', container: 'none', expressivity }),
  highlight: ['expressivity'],
  runLabel: ({ expressivity }) => `${NAMES[expressivity]} (${expressivity})`,
  restartOnPick: true,
  phrases: [
    'Great news, your refund went through this morning! You should see it in your account by Friday, and there is nothing else you need to do. Thanks for sticking with us!',
    'I am sorry, I know this has been frustrating. Let me take a look at your account, and I will stay with you until it is fixed. Take your time, there is no rush.',
    'Welcome back! It has been a while. Your favorite table is open tonight, at seven thirty, and the chef has a new dessert you are going to love.',
  ],

  Controls({ state, setState, busy }) {
    return <Steps label="Expressivity" steps={STEPS} value={state.expressivity} onPick={(expressivity) => setState({ expressivity })} disabled={busy} />
  },
})
