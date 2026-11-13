// Sample rate for linear16. Verified live 2026-11-13 with an API key, encoding=linear16,
// container=none, the same 66-character line:
//   POST /v2/speak flux-wes-en       8000, 16000, 24000, 32000, 44100, 48000 are a 200 with
//                                    audio/l16;rate=<rate>. 12000, 22050, 96000 are a 400
//                                    UNSUPPORTED_AUDIO_FORMAT "`sample_rate` must be 8000, 16000,
//                                    24000, 32000, 44100, or 48000 when `encoding=linear16`".
//   POST /v1/speak aura-2-thalia-en  same six rates a 200, same three a 400 with the same message.
//   flux-cole-en, flux-meghan-en, flux-drew-en, aura-2-apollo-en: 8000, 16000, 24000, 48000 all 200.
//   With no sample_rate, both endpoints answer audio/l16;rate=24000, so 24 kHz is the default.
// Size: 2 bytes a sample, so 16, 32, 48 and 96 KB a second. On flux-wes-en: 8 kHz 65 KB (4.16 s),
// 16 kHz 133 KB (4.24 s), 48 kHz 405 KB (4.32 s). Audio length varies a little call to call, so
// the run card shows the real size and the buttons show the fixed rate per second.
// Detail: an FFT of each file had no energy above half the sample rate (4 kHz at 8000, 8 kHz at
// 16000, 12 kHz at 24000), and the 48 kHz file had real energy above 12 and 16 kHz on both
// endpoints, so 48 kHz is not 24 kHz upsampled. The spectrum on the page stops at 12 kHz, so 24
// and 48 look alike there; the copy says the difference is in the ear and the size.
// Picking a button stops the line and speaks it again at that rate.
// Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
// same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
// spread (0.08 s) of 14 Flux voices tried.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_THEN_AURA } from '../../shared/tts/voices'

type Rate = '8000' | '16000' | '24000' | '48000'

interface State {
  rate: Rate
}

const RATES: { value: Rate; name: string; khz: number }[] = [
  { value: '8000', name: 'Phone', khz: 8 },
  { value: '16000', name: 'Wideband', khz: 16 },
  { value: '24000', name: 'Default', khz: 24 },
  { value: '48000', name: 'Studio', khz: 48 },
]
const byValue = new Map(RATES.map((r) => [r.value, r]))
// 16-bit mono: 2 bytes a sample.
const bytesPerSecond = (khz: number) => (khz * 2000).toLocaleString('en-US')

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'How many kilohertz do you need?',
    lede: 'Press Speak, then pick a sample rate any time: the line starts over at that rate, still 16-bit linear PCM. Listen for the hiss in "s" sounds, and compare the size on the last two runs. Each rate keeps detail up to half its value, and bytes grow with it: 16,000 a second at 8 kHz, 96,000 at 48 kHz. The spectrum stops at 12 kHz, so 24 and 48 look alike there; the difference is in your ear and the file size.',
    ctaTitle: 'Pay for the bandwidth you play.',
    ctaBody: (
      <>
        Add <code>encoding=linear16</code> and <code>sample_rate</code> to the request: 8000, 16000, 24000, 32000,
        44100, or 48000, on Flux voices at <code>/v2/speak</code> and Aura-2 at <code>/v1/speak</code>. Match it to
        where the audio goes: 8 kHz for a phone line, 16 kHz for most speech pipelines, 48 kHz for video. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-sample-rate' },
  voices: FLUX_THEN_AURA,
  initialState: { rate: '24000' },
  variants: RATES.map(({ value }) => ({ rate: value })),
  promptState: { rate: '16000' },
  params: ({ rate }) => ({ encoding: 'linear16', sample_rate: rate, container: 'none' }),
  highlight: ['sample_rate'],
  phoneMark: true,
  restartOnPick: true,
  runLabel: ({ rate }) => {
    const r = byValue.get(rate)
    return r ? `linear16, ${r.khz} kHz: ${bytesPerSecond(r.khz)} bytes a second` : `sample_rate=${rate}`
  },
  phrases: [
    'She sells seashells by the seashore, and the shells she sells are surely seashells. So if she sells shells on the seashore, I am sure she sells seashore shells.',
    'Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. The tracking number is in your email.',
    'Sixty-six silver spoons sat in the sink, so Max scrubbed them, rinsed them, and stacked them on the shelf by the stove.',
  ],

  Controls({ state, setState, busy }) {
    return (
      <Steps
        label="Sample rate"
        steps={RATES.map((r) => ({ name: r.name, detail: `${r.khz} kHz`, value: r.value }))}
        value={state.rate}
        onPick={(rate) => setState({ rate })}
        disabled={busy}
      />
    )
  },
})
