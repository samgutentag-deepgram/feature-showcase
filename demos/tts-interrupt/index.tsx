// Barge-in on the text-to-speech socket. Verified live 2026-11-12, linear16 at 24 kHz, the first
// phrase (211 characters) cut 1.5 s in, then the reply sent on the same socket:
//   wss /v2/speak flux-wes-en, Interrupt with playback_offset 1014 ms
//       SpeechInterrupted in 95 ms: audio_played_ms 1014, text_spoken "Thanks for calling ",
//       text_remaining "Acme support. Your order shipped...". Reply audio 235 ms after the cut.
//   wss /v2/speak flux-wes-en, no Interrupt
//       the rest of the line (9.4 s of audio) streams first; reply audio 7256 ms after the cut.
//   wss /v1/speak aura-2-thalia-en, Clear      Cleared in 21 ms; reply audio 90 ms after the cut.
//   wss /v1/speak aura-2-thalia-en, no Clear   9.8 s of old audio first; reply 4675 ms after.
// Billing is the whole line either way: billable_character_count stayed 211 after an Interrupt.
// Voices: Flux first, Aura-2 after. text_spoken is Flux only; Aura-2's Clear just stops.
// The cut-in is your voice: the mic streams to Flux speech-to-text and its StartOfTurn (about
// 500 ms into the speech, checked 2026-11-12) cuts in, the barge-in signal the Flux TTS docs use.
import { defineTtsFeature } from '../../shared/tts/feature'
import { FLUX_THEN_AURA } from '../../shared/tts/voices'

interface State {
  interrupt: boolean
}

export const HOW = (interrupt: boolean) => (interrupt ? 'Stop the audio and send Interrupt' : 'Stop the audio only')

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Let the caller cut in.',
    lede: 'Press Speak, then talk over the agent while it is still talking, the way a caller would. Flux speech-to-text hears you start, the page cuts in, and the agent answers "Sure, go ahead." Try it with Interrupt, then with the audio stopped in the browser only, and compare how long the answer takes. Flux also says which words you heard.',
    ctaTitle: 'Stop talking when the caller does.',
    ctaBody: (
      <>
        On the <code>/v2/speak</code> socket, send <code>Interrupt</code> with how far playback got. Flux stops
        the turn and returns <code>text_spoken</code>, the words the caller actually heard, for your LLM
        context. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux-tts/interrupt-handling' },
  voices: FLUX_THEN_AURA,
  initialState: { interrupt: true },
  variants: [{ interrupt: false }, { interrupt: true }],
  params: () => ({ encoding: 'linear16', sample_rate: '24000' }),
  highlight: [],
  runLabel: ({ interrupt }) => HOW(interrupt),
  phrases: [
    'Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with today? I can also update your address or change the delivery window.',
    'Here is your summary. You have three meetings tomorrow, the first at nine, and your flight to Denver leaves Friday at six fifteen in the evening. Do you want me to book a car to the airport as well?',
  ],
  cutIn: {
    reply: 'Sure, go ahead.',
    interrupt: ({ interrupt }) => interrupt,
    listen: true,
  },

  Controls({ state, setState, busy }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="When you cut in">
        {[true, false].map((i) => (
          <button
            key={String(i)}
            role="radio"
            aria-checked={state.interrupt === i}
            className={state.interrupt === i ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={busy}
            onClick={() => setState({ interrupt: i })}
          >
            {HOW(i)}
          </button>
        ))}
      </div>
    )
  },
})
