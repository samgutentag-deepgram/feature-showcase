// Clear on the Aura-2 text-to-speech socket (wss /v1/speak). Verified live 2026-11-13, linear16 at
// 24 kHz, the first phrase (211 characters, about 11.1 s of audio), Clear sent 1.5 s after Flush,
// then "Sure, go ahead." on the same socket:
//   thalia  Cleared {"type":"Cleared","sequence_id":0} in 20-67 ms; reply audio 150 ms after Clear
//   apollo  Cleared in 198 ms; reply audio 198 ms after Clear
//   helena  Cleared in 29 ms; reply audio 96 ms after Clear
//   arcas   Cleared in 31 ms; reply audio 99 ms after Clear
// At the cut about 3.0 s of audio had arrived (audio comes about twice as fast as it plays), so
// roughly 1.5 s sat in the browser unplayed: Clear cannot recall it, the page stops it itself.
// 0.04-0.56 s of old audio arrived between Clear and Cleared and was dropped. The old line never
// sent its Flushed; the reply's Flush answered Flushed sequence_id 1.
// No Clear: 8.6 s more old audio, Flushed 0 for the whole line 3.9 s after the cut, and the reply
// queued behind it (its Flushed 1 at 4.6 s).
// sequence_id counts Clear messages on the socket: two Clears on an idle socket gave 0 then 1, and
// a Clear after Flushed 0 still gave 0. A Clear sent after the reply's Speak cleared the reply too.
// Text sent with no Flush was already being spoken (1.0 s out after 500 ms); Clear dropped it.
// Flux has no Clear: {"type":"Clear"} on /v2/speak flux-wes-en answered Error MESSAGE-0000 "The
// message could not be parsed." and closed 1003. Flux uses Interrupt (see demos/tts-interrupt).
import { defineTtsFeature } from '../../shared/tts/feature'

interface State {
  clear: boolean
}

// Four Aura-2 English voices, each checked with Clear on 2026-11-13.
const VOICES = ['aura-2-thalia-en', 'aura-2-helena-en', 'aura-2-arcas-en', 'aura-2-apollo-en']

const HOW = (clear: boolean) => (clear ? 'Stop the audio and send Clear' : 'Stop the audio only')

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Clear what the voice was about to say.',
    lede: 'Press Speak, then press Cut in (or the space bar) while the voice is still talking. The page stops the audio it already has, sends Clear on the Aura-2 socket, and speaks "Sure, go ahead." on the same connection. The run card shows where the old line was at the cut: heard, already in the browser but never played, and still arriving. Try it with Clear, then without, and compare when the answer starts.',
    ctaTitle: 'One message drops the rest of the line.',
    ctaBody: (
      <>
        On the <code>/v1/speak</code> socket, stop your own playback, send <code>{'{"type":"Clear"}'}</code>, and
        drop audio until <code>Cleared</code> arrives. Then send the next <code>Speak</code> on the same socket. On
        Flux, the same job is <code>Interrupt</code>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-ws-clear' },
  voices: VOICES,
  auraOnly:
    'Aura-2 only. Flux does not support Clear: on /v2/speak it is an error and the socket closes. Flux cuts in with Interrupt instead, shown in the text-to-speech interrupt demo.',
  initialState: { clear: true },
  variants: [{ clear: false }, { clear: true }],
  params: () => ({ encoding: 'linear16', sample_rate: '24000' }),
  highlight: [],
  runLabel: ({ clear }) => HOW(clear),
  phrases: [
    'Thanks for calling Acme support. Your order shipped this morning, and it should arrive by Thursday. Is there anything else I can help you with today? I can also update your address or change the delivery window.',
    'Your table for four is booked for Saturday at seven thirty. The restaurant asks that you arrive ten minutes early, and parking is on the street behind the building. Would you like me to send a reminder the day before?',
  ],
  cutIn: {
    reply: 'Sure, go ahead.',
    interrupt: ({ clear }) => clear,
    buffer: true,
  },

  Controls({ state, setState, busy }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="When you cut in">
        {[true, false].map((c) => (
          <button
            key={String(c)}
            role="radio"
            aria-checked={state.clear === c}
            className={state.clear === c ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={busy}
            onClick={() => setState({ clear: c })}
          >
            {HOW(c)}
          </button>
        ))}
      </div>
    )
  },
})
