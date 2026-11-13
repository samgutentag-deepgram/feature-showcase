// Exact silences with an inline pause marker, on Flux batch (POST /v2/speak). Verified live
// 2026-11-12, flux-wes-en and flux-hannah-en, linear16 at 24 kHz:
//   "... 4 7 2. \{pause:1s\} Is there ..."  200, dg-breaks-applied: 1. The longest silence inside
//   the audio measured 900 ms (1s), 2010 ms (2s), 2960 ms (3s), against 440 ms with no marker.
//   {pause:{duration_ms:1500}} (the structured form, no backslashes) is a 200 with one break too.
//   \{pause:250\} -> 400 BREAK_OUT_OF_RANGE ("between 500ms and 3000ms").
// Batch only: on the Flux socket a pause marker fails the connection (DATA-0002, per the docs).
// Flux only: Aura-2 has no pause control. flux-wes-en is the default: the steadiest of 14 English
// Flux voices on 2026-11-11.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_INLINE } from '../../shared/tts/voices'

interface State {
  pause: string
}

const STEPS = [
  { name: 'None', detail: 'no marker', value: '' },
  { name: 'Short', detail: '0.5s', value: '500ms' },
  { name: 'Normal', detail: '1s', value: '1s' },
  { name: 'Long', detail: '2s', value: '2s' },
  { name: 'Longest', detail: '3s', value: '3s' },
]

const mark = (pause: string) => (pause ? ` \\{pause:${pause}\\}` : '')
const line = (pause: string) =>
  `Your confirmation number is 4 7 2 9 1 8.${mark(pause)} Again, that is 4 7 2 9 1 8.${mark(pause)} Is there anything else I can help you with?`

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Give them time to write it down.',
    lede: 'Put a pause marker in the text and Flux leaves exactly that much silence, like a beat after reading out a confirmation number. Pick a length and hear the line again: the markers are right there in the text box, and the gap lands within about 100 ms.',
    ctaTitle: 'Silence, to the tenth of a second.',
    ctaBody: (
      <>
        Write <code>{'\\{pause:1s\\}'}</code> in the text you send to <code>/v2/speak</code>: 500 ms to 3 s, in 100 ms
        steps, up to 8 per request. Batch requests only. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-voice-controls' },
  voices: FLUX_INLINE,
  initialState: { pause: '1s' },
  variants: STEPS.map(({ value }) => ({ pause: value })),
  params: () => ({ encoding: 'linear16', sample_rate: '24000', container: 'none' }),
  highlight: [],
  restartOnPick: true,
  textFor: ({ pause }) => line(pause),
  runLabel: ({ pause }) => (pause ? `pause ${pause}` : 'no pause'),
  phrases: [line('1s')],

  Controls({ state, setState }) {
    return <Steps label="Pause after each number" steps={STEPS} value={state.pause} onPick={(pause) => setState({ pause })} />
  },
})
