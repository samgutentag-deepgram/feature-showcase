// Close the text-to-speech socket without losing the end of the line. Verified live 2026-11-13
// with a Node script on the key from .env, a 195-character line sent as Speak (no Flush), then the
// socket closed 600 ms later, linear16 at 24 kHz, two runs each:
//   wss /v2/speak flux-wes-en, {"type":"Close"}
//       9.2-9.9 s of audio arrived after Close, the whole line; then SpeechMetadata and
//       SessionMetadata (total_billable_character_count 195), then Deepgram closed it (1000).
//   wss /v2/speak flux-wes-en, ws.close() from the client
//       0.6-0.7 s of audio in all, nothing after the close (1000).
//   wss /v1/speak aura-2-thalia-en, {"type":"Close"}
//       7.6-7.7 s of audio after Close, no text message, then Deepgram closed it (1000).
//   wss /v1/speak aura-2-thalia-en, ws.close() from the client
//       1.7 s of audio in all, nothing after the close (Node saw 1006).
// Close finishes the text already sent even with no Flush. Sending Close right after Speak, with or
// without Flush, also played the whole line on both endpoints.
// Voices: Flux first, Aura-2 after. flux-wes-en is the default, the steadiest Flux voice (2026-11-11).
import { defineTtsFeature } from '../../shared/tts/feature'
import { FLUX_THEN_AURA } from '../../shared/tts/voices'

interface State {
  graceful: boolean
}

export const HOW = (graceful: boolean) => (graceful ? 'Send Close' : 'Drop the socket')

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Hang up without cutting off the last line.',
    lede: 'Press Speak. The page sends the line, then closes the socket 600 ms later, while the audio is still coming, the way an app hangs up once it has sent its last words. Send Close and Deepgram finishes the line before it closes. Drop the socket and you hear only what arrived in time. Try both and compare the two runs.',
    ctaTitle: 'Close the socket the polite way.',
    ctaBody: (
      <>
        When you are done sending text on <code>/v2/speak</code> or <code>/v1/speak</code>, send{' '}
        <code>{'{"type":"Close"}'}</code> instead of closing the socket yourself. Deepgram streams the rest of
        the audio, then closes it with 1000. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-ws-close' },
  voices: FLUX_THEN_AURA,
  initialState: { graceful: true },
  variants: [{ graceful: false }, { graceful: true }],
  params: () => ({ encoding: 'linear16', sample_rate: '24000' }),
  highlight: [],
  runLabel: ({ graceful }) => HOW(graceful),
  phrases: [
    'Your order shipped this morning, and it should arrive by Thursday. I will text you the tracking number in a minute, so keep an eye on your phone. Is there anything else I can help you with today?',
    'Thanks for calling. Your appointment is confirmed for Tuesday at ten in the morning with Doctor Patel. Please arrive fifteen minutes early, and bring your insurance card. Have a great day.',
  ],
  close: {
    afterMs: 600,
    graceful: ({ graceful }) => graceful,
  },

  Controls({ state, setState, busy }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="How the page closes the socket">
        {[true, false].map((g) => (
          <button
            key={String(g)}
            role="radio"
            aria-checked={state.graceful === g}
            className={state.graceful === g ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={busy}
            onClick={() => setState({ graceful: g })}
          >
            {HOW(g)}
          </button>
        ))}
      </div>
    )
  },
})
