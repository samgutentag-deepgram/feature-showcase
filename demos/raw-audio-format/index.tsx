// Raw audio formats: headerless audio needs encoding and sample_rate on the request, and they have to
// match the bytes. Checked live 2026-11-16 with a macOS `say` clip converted to each format and
// streamed in real time: Flux (/v2/listen) and Nova-3 (/v1/listen) both transcribed linear16 16 kHz,
// linear16 8 kHz, mulaw 8 kHz, and alaw 8 kHz word for word ("please call me back at the front desk,
// my account number is four two seven nine"), from ffmpeg's conversion and from the page's own
// transcoder (shared/stt/audio.ts). Mismatch (linear16 16 kHz bytes, declared mulaw 8 kHz): no error,
// the socket closes normally, and the transcript is empty on both models.
import { defineFeature, type AudioFormat, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'

export type Format = 'linear16-16k' | 'linear16-8k' | 'mulaw-8k' | 'alaw-8k' | 'mismatch'

interface State {
  format: Format
}

interface Choice {
  label: string
  // What the request declares, on the Request card.
  declared: AudioFormat
  // What the page actually streams.
  sent: AudioFormat
  about: string
}

const L16_16K: AudioFormat = { encoding: 'linear16', sample_rate: 16000 }
const MULAW_8K: AudioFormat = { encoding: 'mulaw', sample_rate: 8000 }

export const FORMATS: Record<Format, Choice> = {
  'linear16-16k': {
    label: 'linear16 16 kHz',
    declared: L16_16K,
    sent: L16_16K,
    about: '16-bit PCM at 16 kHz, 32 KB a second. What most browser and app capture produces.',
  },
  'linear16-8k': {
    label: 'linear16 8 kHz',
    declared: { encoding: 'linear16', sample_rate: 8000 },
    sent: { encoding: 'linear16', sample_rate: 8000 },
    about: '16-bit PCM at 8 kHz, 16 KB a second. Half the samples, still uncompressed.',
  },
  'mulaw-8k': {
    label: 'mulaw 8 kHz',
    declared: MULAW_8K,
    sent: MULAW_8K,
    about: 'G.711 mu-law at 8 kHz, 8 KB a second. Phone audio in North America and Japan.',
  },
  'alaw-8k': {
    label: 'alaw 8 kHz',
    declared: { encoding: 'alaw', sample_rate: 8000 },
    sent: { encoding: 'alaw', sample_rate: 8000 },
    about: 'G.711 A-law at 8 kHz, 8 KB a second. Phone audio in Europe and most of the rest of the world.',
  },
  mismatch: {
    label: 'Mismatch',
    declared: MULAW_8K,
    sent: L16_16K,
    about: 'Streams linear16 at 16 kHz but declares mulaw at 8 kHz. Deepgram has no header to check, so it decodes the bytes as mu-law, finds no words, and sends back an empty transcript with no error.',
  },
}

export const ORDER = Object.keys(FORMATS) as Format[]

const named = (f: AudioFormat) => `${f.encoding} at ${f.sample_rate / 1000} kHz`

export default defineFeature<State>({
  copy: {
    headline: 'Raw audio has no header. Say what it is.',
    lede: 'Pick a format and read the phrase. The page streams your mic as linear16, mulaw, or alaw and names it with encoding and sample_rate. Then try Mismatch, which sends one format and declares another.',
    ctaTitle: 'Send encoding and sample_rate with raw audio.',
    ctaBody: (
      <>
        Headerless audio needs <code>encoding</code> and <code>sample_rate</code> on the request, and they
        have to match the bytes. Get them wrong and there is no error, only an empty or wrong
        transcript. Phone audio streams straight in as <code>mulaw</code> or <code>alaw</code> at 8 kHz, on
        Flux and Nova-3. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/encoding' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
    },
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
    },
  ],
  // Live mic only. Runs stay side by side, so a format and the mismatch can be compared.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { format: 'mulaw-8k' },
  variants: ORDER.map((format) => ({ format })),
  // The prompt's mic section (shared/common/prompt.ts) always describes 16 kHz linear16 capture, so
  // the prompt shows that format; any other would contradict its own URL.
  promptState: { format: 'linear16-16k' },

  // What the request declares. Shown on the Request card and sent as given.
  params: ({ format }): Params => ({
    encoding: FORMATS[format].declared.encoding,
    sample_rate: String(FORMATS[format].declared.sample_rate),
  }),
  // What the page streams. Differs from the params only for the mismatch.
  audio: ({ format }) => FORMATS[format].sent,
  highlight: ['encoding', 'sample_rate'],

  runLabel: ({ format }) => FORMATS[format].label,
  compareTip: ({ format }) =>
    format === 'mismatch' ? 'Pick a matching format and read it again to compare.' : 'Pick Mismatch and read it again to see what wrong params do.',

  phrases: () => ['Please call me back at the front desk. My account number is four two seven nine.'],

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    const f = FORMATS[state.format]
    return (
      <>
        <div className="segmented" role="radiogroup" aria-label="Audio format">
          {ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={state.format === id}
              className={state.format === id ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => setState({ format: id })}
            >
              {FORMATS[id].label}
            </button>
          ))}
        </div>
        <p className="note">
          Streams {named(f.sent)}; declares {named(f.declared)}. {f.about}
        </p>
      </>
    )
  },

  Response({ latest }) {
    if (!latest) {
      return <span className="wire__key">The last final transcript shows up here after a run.</span>
    }
    const text = typeof latest.echoed === 'string' ? latest.echoed : ''
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"transcript":</span> <mark>{JSON.stringify(text)}</mark>
      </span>
    )
  },

  Result({ run, live, state }) {
    const format = run?.state.format ?? state.format
    return (
      <PlainTranscript
        committed={run?.committed ?? []}
        pending={run?.pending ?? []}
        live={live}
        emptyText={
          format === 'mismatch'
            ? 'Nothing comes back: the bytes are linear16, but the request says mulaw, so Deepgram finds no words in it.'
            : 'Your transcript shows up here. Read the phrase above.'
        }
      />
    )
  },
})
