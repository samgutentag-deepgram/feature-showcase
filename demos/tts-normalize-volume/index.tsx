// Loudness normalization across voices. Verified live 2026-11-13 on POST /v2/speak, linear16 at
// 24 kHz, container=none:
//   normalize_volume=true and =false are a 200; =bogus is a 400 "expected a boolean". The docs
//   say it defaults to true, and leaving it out measured the same as true on drew and hannah,
//   so the page always sends it, and the card says which one ran.
//   Same line, five voices (wes, drew, hannah, marcus, brittany), 3 calls each, speech level as
//   RMS of 20 ms windows above -50 dBFS:
//     false: -19.7 to -15.6 dBFS, a 4.1 dB spread. drew ran up to 3.5 dB under the rest, with peaks
//            down to -4.4 dBFS; marcus drifted 0.9 dB and brittany 1.1 dB between calls.
//     true:  -17.5 to -16.0 dBFS, a 1.6 dB spread, every peak at -1.5 dBFS.
//   A second line over seven voices gave 4.7 dB off and 1.4 dB on.
// Flux only: /v1/speak takes the param on aura-2-thalia-en with a 200, but it ignores unknown
// params, so that proves nothing; the docs list it for /v2/speak.
// marcus and brittany are in the lineup on purpose (cleared for use; they drift in volume between
// calls), never first: flux-wes-en leads, as everywhere.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { DEFAULT_VOICE } from '../../shared/tts/voices'

interface State {
  normalize: 'true' | 'false'
}

const STEPS: { name: string; detail: string; value: State['normalize'] }[] = [
  { name: 'Off', detail: 'normalize_volume=false', value: 'false' },
  { name: 'On', detail: 'normalize_volume=true', value: 'true' },
]

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Every voice at the same volume.',
    lede: 'Press Speak and the same line plays in five Flux voices, back to back. Turn normalization off and some voices come out quieter than others, and the same voice can change level from one call to the next. Turn it on and they all land within a dB or two. The page measures each one as it plays. Flux TTS only.',
    ctaTitle: 'Level by default, raw when you want it.',
    ctaBody: (
      <>
        <code>normalize_volume</code> is on by default on Flux voices at <code>/v2/speak</code>. Send{' '}
        <code>normalize_volume=false</code> to get each voice at its own level, for when you do your own mixing.
        New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/reference/speak/v-2/audio/generate' },
  voices: [DEFAULT_VOICE, 'flux-drew-en', 'flux-hannah-en', 'flux-marcus-en', 'flux-brittany-en'],
  lineup: true,
  initialState: { normalize: 'false' },
  variants: [{ normalize: 'false' }, { normalize: 'true' }],
  promptState: { normalize: 'true' },
  params: ({ normalize }) => ({ encoding: 'linear16', sample_rate: '24000', container: 'none', normalize_volume: normalize }),
  highlight: ['normalize_volume'],
  restartOnPick: true,
  runLabel: ({ normalize }) => `normalize_volume=${normalize}`,
  phrases: [
    'Your table for four is ready. Please head to the host stand by the front door.',
    'Thanks for calling. Your order shipped this morning and should arrive on Thursday.',
    'Your prescription is ready. You can pick it up at the pharmacy counter after two.',
  ],

  Controls({ state, setState, busy }) {
    return <Steps label="Loudness normalization" steps={STEPS} value={state.normalize} onPick={(normalize) => setState({ normalize })} disabled={busy} />
  },
})
