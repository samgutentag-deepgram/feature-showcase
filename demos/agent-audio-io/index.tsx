// Agent audio formats: the same agent over browser audio (linear16) and phone audio (mulaw or alaw at
// 8 kHz), set by the Settings audio block. Checked live 2026-11-16 with a one-off script per format:
// Settings, a greeting, then a 2.6 s spoken question encoded with shared/agent/codec.ts the way the
// page encodes the mic. Every combo below came back SettingsApplied, the agent heard the question
// ("What is the capital of France?") and answered, and the reply bytes decoded at the Settings rate:
//   linear16 16 kHz in, 24 kHz out: 48,000 bytes per second of reply audio, greeting 4.2 s.
//   linear16 16 kHz in, 16 kHz out: 32,000 B/s.   linear16 8 kHz in, 16 kHz out: 32,000 B/s.
//   mulaw 8 kHz both ways: 8,000 B/s, greeting 4.6 s.   alaw 8 kHz both ways: 8,000 B/s.
// Flux and Nova-3 listen both understood mulaw and alaw 8 kHz input. Energy above 4 kHz: 1.5 to 3.8%
// of each 24 kHz reply, 0.5 to 1.8% at 16 kHz, none at 8 kHz (it cannot carry anything above 4 kHz).
// Rejected or changed: output mp3 with a Flux voice -> Error INVALID_SETTINGS. container wav with a
// Flux voice is NOT rejected, though the docs say INVALID_SETTINGS: a Warning
// SPEAK_STREAMING_FORMAT_UNSUPPORTED arrives, then each reply comes whole as one WAV file ("RIFF" and
// a 44-byte header, then 48,000 B/s). The page plays raw audio only, so it offers container none.
// Verified live 2026-11-16: verify:live sent all four Settings audio blocks (mulaw 8k, alaw 8k, linear16 16k/16k, linear16 16k/24k) with Flux and Nova-3 listen, all 8 came back SettingsApplied; docs links resolved.
import type { AgentAudio } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

type Preset = 'browser' | 'wideband' | 'mulaw' | 'alaw'

interface State {
  preset: Preset
}

interface Format {
  label: string
  where: string
  audio: AgentAudio
}

export const FORMATS: Record<Preset, Format> = {
  browser: {
    label: 'Browser',
    where: 'The default: what a web page or app sends and plays.',
    audio: { input: { encoding: 'linear16', sample_rate: 16000 }, output: { encoding: 'linear16', sample_rate: 24000, container: 'none' } },
  },
  wideband: {
    label: 'Wideband',
    where: '16 kHz both ways, for a softphone or a WebRTC call.',
    audio: { input: { encoding: 'linear16', sample_rate: 16000 }, output: { encoding: 'linear16', sample_rate: 16000, container: 'none' } },
  },
  mulaw: {
    label: 'Phone mu-law',
    where: 'G.711 mu-law at 8 kHz: Twilio Media Streams and most North American phone lines.',
    audio: { input: { encoding: 'mulaw', sample_rate: 8000 }, output: { encoding: 'mulaw', sample_rate: 8000, container: 'none' } },
  },
  alaw: {
    label: 'Phone A-law',
    where: 'G.711 A-law at 8 kHz: phone lines in Europe and most of the rest of the world.',
    audio: { input: { encoding: 'alaw', sample_rate: 8000 }, output: { encoding: 'alaw', sample_rate: 8000, container: 'none' } },
  },
}

const PRESETS = Object.keys(FORMATS) as Preset[]

// Raw audio has no compression: bytes per second is the sample rate times the bytes in one sample.
export const bytesPerSample = (encoding: string) => (encoding === 'linear16' ? 2 : 1)
export const bytesPerSecond = (side: { encoding: string; sample_rate: number }) => side.sample_rate * bytesPerSample(side.encoding)

const MAX_RATE = 48_000
const n = (x: number) => x.toLocaleString('en-US')

function Flow({ dir, side }: { dir: string; side: { encoding: string; sample_rate: number } }) {
  const bps = bytesPerSecond(side)
  return (
    <div className="aio__flow">
      <span className="aio__dir">{dir}</span>
      <span className="aio__bar" aria-hidden="true">
        <span className="aio__fill" style={{ width: `${(bps / MAX_RATE) * 100}%` }} />
      </span>
      <span className="aio__num">
        <strong>{n(bps)}</strong> bytes/s
      </span>
      <span className="aio__how">
        {side.encoding}, {n(side.sample_rate)} Hz x {bytesPerSample(side.encoding)} byte{bytesPerSample(side.encoding) > 1 ? 's' : ''}, nothing above{' '}
        {n(side.sample_rate / 2)} Hz
      </span>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Talk to the agent over a phone line.',
    lede: 'Pick the audio format, press Start, and talk. The Settings audio block tells the agent what your mic sends and what it should send back. Browser audio is 16-bit PCM; phone audio is 8-bit mu-law or A-law at 8 kHz, a sixth of the reply bytes, and it sounds narrower because 8 kHz audio carries nothing above 4 kHz.',
    ctaTitle: 'Plug the agent into your phone line.',
    ctaBody: (
      <>
        Set <code>audio.input</code> and <code>audio.output</code> to <code>mulaw</code> at 8000 Hz and the agent hears and speaks
        the format phone lines carry. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-media-inputs-outputs' },
  initialState: { preset: 'mulaw' },
  // Phone mu-law first: prompt.md is written from the first variant.
  variants: (['mulaw', 'alaw', 'wideband', 'browser'] as const).map((preset) => ({ preset })),
  audio: ({ preset }) => FORMATS[preset].audio,
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly phone assistant. Answer in one or two short sentences. If asked to repeat a phrase, say it back exactly.',
    },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: "Hi, you're on the line. Ask me anything.",
  }),
  highlight: ['audio', 'input', 'output', 'encoding', 'sample_rate', 'container'],
  events: ['SettingsApplied', 'AgentAudioDone'],
  flushOnUserSpeech: () => true,
  runLabel: ({ preset }) => FORMATS[preset].label,
  phrases: () => ['What is the capital of France?', "Repeat after me: she sells seashells by the seashore. (The s sounds show the difference most.)"],

  Controls({ state, setState, busy }) {
    return (
      <div className="aio__controls">
        <div className="segmented" role="radiogroup" aria-label="Audio format">
          {PRESETS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={state.preset === p}
              className={state.preset === p ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ preset: p })}
            >
              {FORMATS[p].label}
            </button>
          ))}
        </div>
        <p className="hint">{FORMATS[state.preset].where} Run it twice, once as a phone format and once as Browser, and listen to the s sounds.</p>
      </div>
    )
  },

  Panel({ state }) {
    const { audio } = FORMATS[state.preset]
    return (
      <div className="aio">
        <div className="aio__block">
          <span className="aio__label">Settings audio block</span>
          <pre>
            <code>{JSON.stringify({ audio }, null, 2)}</code>
          </pre>
        </div>
        <div className="aio__flows">
          <span className="aio__label">Bytes per second, each way</span>
          <Flow dir="Mic to agent" side={audio.input} />
          <Flow dir="Agent to you" side={audio.output} />
          <p className="note">
            Measured live 2026-11-16: reply audio came back at exactly these rates in every format. A short greeting
            decoded to 4.2 s at 24 kHz and 4.6 s at 8 kHz mu-law, so the bytes play at the rate Settings names. In a 24 kHz reply 1.5 to 3.8% of the energy sat above 4 kHz,
            where s and f sounds live. In an 8 kHz reply there was none.
          </p>
          <p className="note">
            Containers: ask for <code>container: "wav"</code> with a Flux voice and the agent warns{' '}
            <code>SPEAK_STREAMING_FORMAT_UNSUPPORTED</code>, then sends each reply whole as one WAV file instead of
            streaming it. This page plays raw audio, so it sends <code>none</code>. Compressed output such as{' '}
            <code>mp3</code> needs an Aura voice; with a Flux voice it fails with <code>INVALID_SETTINGS</code>.
          </p>
        </div>
      </div>
    )
  },
})
