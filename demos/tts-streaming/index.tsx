// Play text-to-speech as it arrives, or wait for the file. Verified live 2026-11-11, the
// 3-sentence first phrase, 3 runs each, container=wav and none alike:
//   POST /v2/speak flux-wes-en:      first byte 206-324 ms, last byte 5175-6064 ms, 126-202 chunks
//   POST /v1/speak aura-2-thalia-en: first byte 115-326 ms, last byte 3322-3861 ms, 179-211 chunks
// So the wait is on the client: with container=wav this page decodes the whole file before it
// plays, the way most code handles a file. With container=none it plays raw 16-bit samples as
// each chunk lands. Same request otherwise, same audio.
// Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
// same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
// spread (0.08 s) of 14 Flux voices tried.
import { defineTtsFeature } from '../../shared/tts/feature'
import { FLUX_THEN_AURA } from '../../shared/tts/voices'

type Container = 'wav' | 'none'

interface State {
  container: Container
}

export const HOW: Record<Container, string> = {
  wav: 'Wait for the file: container=wav',
  none: 'Play as it arrives: container=none',
}

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Hear it before it finishes.',
    lede: 'Deepgram streams the audio back as it is generated. Speak a long line both ways: wait for the whole file, or play the raw samples as each chunk arrives. Compare the first-audio time on each run.',
    ctaTitle: 'Start playing on the first chunk.',
    ctaBody: (
      <>
        Ask <code>/v2/speak</code> for <code>container=none</code> and play the bytes as they stream in,
        instead of waiting for a file. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/streaming-the-audio-output' },
  voices: FLUX_THEN_AURA,
  initialState: { container: 'wav' },
  variants: [{ container: 'wav' }, { container: 'none' }],
  params: ({ container }) => ({ encoding: 'linear16', sample_rate: '24000', container }),
  highlight: ['container'],
  runLabel: ({ container }) => HOW[container],
  phrases: [
    'Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with today?',
    'Here is your summary. You have three meetings tomorrow, the first at nine, and your flight to Denver leaves Friday at six fifteen in the evening.',
  ],

  Controls({ state, setState, busy }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="Playback">
        {(Object.keys(HOW) as Container[]).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={state.container === c}
            className={state.container === c ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={busy}
            onClick={() => setState({ container: c })}
          >
            {HOW[c]}
          </button>
        ))}
      </div>
    )
  },
})
