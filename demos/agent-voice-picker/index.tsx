// Agent voice picker: choose the voice a Deepgram voice agent speaks with, agent.speak.provider.
// Checked live 2026-11-16 with a one-off script, one session per voice: Settings with that speak
// provider and a two-word greeting, then SettingsApplied, the greeting's audio and AgentAudioDone.
// All 36 English Flux voices (version "v2") and all 41 English Aura-2 voices came back with audio,
// first chunk in 0.19 to 0.44 s; none was rejected. An Aura-2 model with version "v2" is
// INVALID_SETTINGS ("not a Flux model"). A Flux model with no version was also accepted, though the
// docs say v2 is required, so the page always sends it.
// The voice lists are the English rows of the Flux and Aura-2 catalogs the two voice tours use.
// Third-party providers (OpenAI, ElevenLabs, Cartesia BYO, Polly) need the visitor's own keys in
// agent.speak.endpoint, so they are left out.
// Verified live 2026-11-16: pnpm verify:live sent the Settings for flux-wes-en (version v2) and
// aura-2-thalia-en with Flux and Nova-3 listening, and the prompt.md Settings with a granted token;
// each came back SettingsApplied, and the docs link resolved.
import { defineAgentFeature } from '../../shared/agent/feature'
import { DEFAULT_VOICE } from '../../shared/tts/voices'
import { VOICES as AURA_CATALOG } from '../aura-voice-picker/voices'
import { VOICES as FLUX_CATALOG } from '../flux-tts-voices/voices'
import './styles.css'

type Family = 'Flux' | 'Aura-2'

interface State {
  voice: string
}

interface Voice {
  model: string
  name: string
  family: Family
  detail: string
}

const english = (catalog: typeof FLUX_CATALOG, family: Family): Voice[] =>
  catalog
    .filter((v) => v.lang === 'English')
    .map((v) => ({ model: v.model, name: v.name, family, detail: [v.accent, v.gender].filter(Boolean).join(', ') }))

// Flux first, flux-wes-en at the top (the steadiest across calls), then Aura-2.
const FLUX = english(FLUX_CATALOG, 'Flux').sort((a, b) => Number(b.model === DEFAULT_VOICE) - Number(a.model === DEFAULT_VOICE))
const AURA = english(AURA_CATALOG, 'Aura-2')
export const VOICES = [...FLUX, ...AURA]
const byModel = new Map(VOICES.map((v) => [v.model, v]))
const familyOf = (model: string): Family => (model.startsWith('flux-') ? 'Flux' : 'Aura-2')

// Flux voices take version "v2"; Aura-2 voices leave it out (it defaults to "v1").
export const speakProvider = (model: string) =>
  familyOf(model) === 'Flux' ? { type: 'deepgram', version: 'v2', model } : { type: 'deepgram', model }

const nameOf = (model: string) => byModel.get(model)?.name ?? model

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Pick the voice your agent speaks with.',
    lede: `Choose one of ${FLUX.length} English Flux voices or ${AURA.length} Aura-2 voices, then press Start and talk. The agent greets you and answers in that voice. One field in the Settings message picks it: agent.speak.provider.`,
    ctaTitle: 'Any Deepgram voice, one field.',
    ctaBody: (
      <>
        Set <code>agent.speak.provider.model</code> in <code>Settings</code>. Flux voices add{' '}
        <code>"version": "v2"</code>; Aura-2 voices leave it out. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-tts-models' },
  initialState: { voice: DEFAULT_VOICE },
  // One Settings shape per family; the model string is the only other difference. Every voice in
  // VOICES was checked live on 2026-11-16 (see the top of this file).
  variants: [{ voice: DEFAULT_VOICE }, { voice: 'aura-2-thalia-en' }],
  agent: ({ voice }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly guide. Answer in one or two short sentences.',
    },
    speak: { provider: speakProvider(voice) },
    greeting: `Hi, I am ${nameOf(voice)}. Ask me anything.`,
  }),
  highlight: ['speak'],
  events: [],
  flushOnUserSpeech: () => true,
  runLabel: ({ voice }) => `${nameOf(voice)} (${familyOf(voice)})`,
  phrases: () => ['Tell me a fun fact about octopuses.', '(Stop, pick another voice, press Start, and ask again.)'],

  Controls({ state, setState, busy }) {
    const family = familyOf(state.voice)
    const list = family === 'Flux' ? FLUX : AURA
    return (
      <div className="avp">
        <div className="segmented" role="radiogroup" aria-label="Voice family">
          {(['Flux', 'Aura-2'] as const).map((f) => (
            <button
              key={f}
              role="radio"
              aria-checked={family === f}
              className={family === f ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => family !== f && setState({ voice: f === 'Flux' ? DEFAULT_VOICE : AURA[0].model })}
            >
              {f} ({f === 'Flux' ? FLUX.length : AURA.length})
            </button>
          ))}
        </div>
        <label className="avp__label" htmlFor="avp-voice">
          Voice
        </label>
        <select id="avp-voice" value={state.voice} disabled={busy} onChange={(e) => setState({ voice: e.target.value })}>
          {list.map((v) => (
            <option key={v.model} value={v.model}>
              {v.name}
              {v.detail ? `, ${v.detail}` : ''}
            </option>
          ))}
        </select>
        <p className="note">
          The voice is set when the call starts. To hear another one, stop, pick it, and press Start again. The API also takes
          third-party voices (OpenAI, ElevenLabs, Cartesia, Polly) with your own key for that provider; this page sticks to
          Deepgram voices.
        </p>
      </div>
    )
  },
})
