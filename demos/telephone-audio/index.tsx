// Phone line to studio quality. Verified live 2026-11-11 on POST /v2/speak with flux-cole-en and
// flux-wes-en (and 2026-11-10 on /v1/speak with aura-2-thalia-en), with a 30-second token:
//   encoding=mulaw&sample_rate=8000&container=none     200 audio/mulaw;rate=8000, 1 byte a sample
//   encoding=linear16&sample_rate=24000&container=none 200, 2 bytes a sample at 3x the rate
// 48 kHz linear16 is checked the same way by pnpm verify:live, for every voice.
// The 8 kHz version is what a phone call carries: nothing above 4 kHz, which the spectrum shows.
// Picking a button stops the line and speaks it again in that format.
// Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
// same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
// spread (0.08 s) of 14 Flux voices tried.
import { defineTtsFeature } from '../../shared/tts/feature'

import { Steps } from '../../shared/tts/Steps'
import { FLUX_THEN_AURA } from '../../shared/tts/voices'

type Quality = 'phone' | 'full' | 'studio'

interface State {
  quality: Quality
}

export const QUALITY: Record<Quality, { name: string; detail: string; label: string; params: Record<string, string> }> = {
  phone: { name: 'Lowest', detail: 'phone line, 8 kHz', label: 'Phone line: mu-law, 8 kHz', params: { encoding: 'mulaw', sample_rate: '8000', container: 'none' } },
  full: { name: 'Normal', detail: '24 kHz', label: 'Normal: 16-bit, 24 kHz', params: { encoding: 'linear16', sample_rate: '24000', container: 'none' } },
  studio: { name: 'Highest', detail: '48 kHz', label: 'Highest: 16-bit, 48 kHz', params: { encoding: 'linear16', sample_rate: '48000', container: 'none' } },
}
const ORDER: Quality[] = ['phone', 'full', 'studio']

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Does it sound like a phone call?',
    lede: 'Press Speak, then pick a quality any time: the line starts over in that format. Lowest is a phone line (mu-law at 8 kHz, what a call center or Twilio stream carries); Highest is 48 kHz. Listen, and watch the spectrum: the phone line stops at 4 kHz.',
    ctaTitle: 'Ask for the audio your pipeline needs.',
    ctaBody: (
      <>
        Flux voices on <code>/v2/speak</code> take <code>encoding</code> and <code>sample_rate</code>, so a
        voice agent on a phone line gets mu-law at 8 kHz with no conversion step. Aura-2 on{' '}
        <code>/v1/speak</code> takes the same params. New accounts start with
        $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-media-output-settings' },
  voices: FLUX_THEN_AURA,
  initialState: { quality: 'full' },
  variants: ORDER.map((quality) => ({ quality })),
  promptState: { quality: 'phone' },
  params: ({ quality }) => QUALITY[quality].params,
  highlight: ['encoding', 'sample_rate'],
  phoneMark: true,
  restartOnPick: true,
  runLabel: ({ quality }) => QUALITY[quality].label,
  phrases: [
    'Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. The tracking number is in your email, and if you are not home, the driver will leave it at the front desk. Is there anything else I can help you with today?',
    'She sells seashells by the seashore, and the shells she sells are surely seashells. So if she sells shells on the seashore, I am sure she sells seashore shells.',
    'Please say or enter your account number, followed by the pound sign. If you do not know your account number, just say, I do not know. To hear these options again, press star.',
  ],

  Controls({ state, setState, busy }) {
    return (
      <Steps
        label="Call quality"
        steps={ORDER.map((q) => ({ name: QUALITY[q].name, detail: QUALITY[q].detail, value: q }))}
        value={state.quality}
        onPick={(quality) => setState({ quality })}
        disabled={busy}
      />
    )
  },
})
