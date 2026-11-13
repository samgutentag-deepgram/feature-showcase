// Bit rate. Verified live 2026-11-13 with curl, on POST /v2/speak flux-wes-en and POST /v1/speak
// aura-2-thalia-en, the same 98-character line (bytes are Flux, then Aura-2):
//   encoding=mp3&bit_rate=8000|16000|24000|32000|48000   200 audio/mpeg
//     8000 -> 4,680 / 5,760   16000 -> 10,440 / 10,584   24000 -> 15,120 / 16,632
//     32000 -> 21,734 / 20,062   48000 -> 31,536 / 35,568 (no bit_rate is 48000)
//     bit_rate=64000 is a 400 on both: "`bit_rate` must be 8000, 16000, 24000, 32000, 40000, or
//     48000 when `encoding=mp3`". The docs table lists 32000 and 48000 only; the API takes all six.
//     ffprobe: the encoder also drops the sample rate as the bit rate falls: 48k -> 24 kHz,
//     32k -> 22.05 kHz, 24k and 16k -> 16 kHz, 8k -> 8 kHz. container=none with mp3 is a 400.
//   encoding=opus&container=ogg&bit_rate=4000|8000|12000|32000|64000   200 audio/ogg;codecs=opus
//     4000 -> 3,043 / 3,554   8000 -> 5,258 / 7,088   12000 -> 8,634 / 9,529
//     32000 -> 24,503 / 21,047   64000 -> 40,481 / 44,050. 3000 is a 400 ("between 4000 and
//     650000"); 650000 is a 200 at 185,714 bytes. container=none with opus is a 400.
//     Sizes move by up to about 15% between identical calls (the speech itself varies).
//   The same line as linear16 24 kHz container=wav: 230,444 / 245,804 bytes, about 5 s of audio.
// /v2/speak answers 400 INVALID_QUERY_PARAMETER for an unknown param, so its 200s prove Flux takes
// bit_rate. Picking a button stops the line and speaks it again at that bit rate.
// Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
// same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
// spread (0.08 s) of 14 Flux voices tried.
import type { Params } from '../../shared/common/feature'
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_THEN_AURA } from '../../shared/tts/voices'
import './styles.css'

type Encoding = 'mp3' | 'opus'

interface State {
  encoding: Encoding
  bit_rate: string
}

const NAMES = ['Smallest', 'Smaller', 'Middle', 'Larger', 'Largest']

// Five bit rates per encoding, smallest file to largest. Each is a 200 on both endpoints.
export const RATES: Record<Encoding, { label: string; defaultRate: string; rates: string[] }> = {
  mp3: { label: 'MP3', defaultRate: '48000', rates: ['8000', '16000', '24000', '32000', '48000'] },
  opus: { label: 'Opus', defaultRate: '12000', rates: ['4000', '8000', '12000', '32000', '64000'] },
}
const ENCODINGS: Encoding[] = ['mp3', 'opus']

const kbps = (rate: string) => `${Number(rate) / 1000} kbps`

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'How small can the file get?',
    lede: 'Press Speak, then pick a bit rate any time: the line starts over at that size. Each run shows the real bytes Deepgram sent back, and the last two sit side by side. Go low and listen for the voice to go thin; watch the spectrum lose its top end on MP3.',
    ctaTitle: 'Pay for the bytes you need.',
    ctaBody: (
      <>
        Add <code>bit_rate</code> with <code>encoding=mp3</code> or <code>encoding=opus</code>, on Flux voices at{' '}
        <code>/v2/speak</code> and Aura-2 at <code>/v1/speak</code>. The same five-second line came back as 3 KB of
        Opus at 4 kbps, 31 KB of MP3 at 48 kbps, and 225 KB as a WAV. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-bit-rate' },
  voices: FLUX_THEN_AURA,
  initialState: { encoding: 'mp3', bit_rate: RATES.mp3.defaultRate },
  variants: ENCODINGS.flatMap((encoding) => RATES[encoding].rates.map((bit_rate) => ({ encoding, bit_rate }))),
  promptState: { encoding: 'mp3', bit_rate: '32000' },
  params: ({ encoding, bit_rate }): Params => (encoding === 'opus' ? { encoding, container: 'ogg', bit_rate } : { encoding, bit_rate }),
  highlight: ['encoding', 'bit_rate'],
  restartOnPick: true,
  runLabel: ({ encoding, bit_rate }) => `${RATES[encoding].label} at ${kbps(bit_rate)}`,
  phrases: [
    'Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. The tracking number is in your email, and if you are not home, the driver will leave it at the front desk.',
    'She sells seashells by the seashore, and the shells she sells are surely seashells. So if she sells shells on the seashore, I am sure she sells seashore shells.',
    'Your verification code is 5 0 9 2 7 1. Six sixty six Fifth Avenue, suite 1450. Please have your fax number ready.',
  ],

  Controls({ state, setState, busy }) {
    const { rates, defaultRate } = RATES[state.encoding]
    // Switching encoding keeps the same position in the row, so Smallest stays Smallest.
    const swap = (encoding: Encoding) => {
      const i = Math.max(0, rates.indexOf(state.bit_rate))
      setState({ encoding, bit_rate: RATES[encoding].rates[i] })
    }
    return (
      <div className="bit-rate">
        <div className="segmented" role="radiogroup" aria-label="Encoding">
          {ENCODINGS.map((e) => (
            <button
              key={e}
              role="radio"
              aria-checked={state.encoding === e}
              className={state.encoding === e ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => state.encoding !== e && swap(e)}
            >
              {RATES[e].label}
            </button>
          ))}
        </div>
        <Steps
          label="Bit rate"
          steps={rates.map((r, i) => ({ name: NAMES[i], detail: r === defaultRate ? `${kbps(r)}, default` : kbps(r), value: r }))}
          value={state.bit_rate}
          onPick={(bit_rate) => setState({ encoding: state.encoding, bit_rate })}
          disabled={busy}
        />
      </div>
    )
  },
})
