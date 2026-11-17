// Multilingual voice agent: talk to it in English, then Spanish, and it answers in whichever you used.
// Checked live 2026-11-16 on the Agent API with macOS `say` clips (Samantha in English, Paulina in
// Spanish) streamed into one call, listen flux-general-multi with language_hints ["en", "es"]:
//   "What time do you open on Saturday?" came back as a user ConversationText with
//   languages ["en"] and languages_hinted ["en", "es"]; the agent said "We open at eleven on Saturday."
//   "¿A qué hora abren el sábado?" came back with languages ["es"]; the agent said
//   "Abrimos a las once el sábado." Same order reversed (Spanish first) gave the same pairing.
//   Nova-3 with language "multi" heard and answered both lines too, but its user ConversationText
//   carries no languages field.
// No agent.language: flux-general-multi refuses it (INVALID_SETTINGS). Flux takes no language field.
// Voices: Flux TTS voices speak one language each (the code at the end of the name). An STT pass over
// flux-carmen-es saying the English reply came back "we open a telephone on saturday", so the default
// is aura-2-javier-es, one of the five Aura-2 voices the docs list as switching between English and
// Spanish. Before "Write numbers and times as words" went into the prompt, aura-2-selena-es and
// flux-carmen-es both read "11 AM" in an English reply as "once de la mañana".
// Verified live 2026-11-16: verify:live sent the Settings message for both voices (aura-2-javier-es v1, flux-carmen-es v2) with both listen models (flux-general-multi with language_hints en and es, nova-3 with language multi), all came back SettingsApplied, and the prompt.md Settings applied with a granted token. A say-clip call on the default Settings heard "What time do you open on Saturday?" as languages ["en"] and answered "We open at eleven on Saturday.", then "¿A qué hora abren el sábado?" as languages ["es"] and answered "Abrimos a las once el sábado.", both in aura-2-javier-es.
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

export const VOICES = [
  { id: 'flux-carmen-es', label: 'Flux Carmen', note: 'Spanish only' },
  { id: 'aura-2-javier-es', label: 'Aura-2 Javier', note: 'English and Spanish' },
] as const

type Voice = (typeof VOICES)[number]['id']

interface State {
  voice: Voice
}

export const HINTS = ['en', 'es']

export const PROMPT =
  'You take phone orders for Acme Pizza. The shop opens at 11 on Saturday. Match the language of each user message independently. Write numbers and times as words in that language. Keep answers to one short sentence.'

const NAMES: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', hi: 'Hindi', ru: 'Russian', ja: 'Japanese' }

// Flux TTS is version v2, Aura-2 is v1 (both checked live).
const speakOf = (voice: Voice): Json => ({ provider: { type: 'deepgram', model: voice, version: voice.startsWith('flux-') ? 'v2' : 'v1' } })

const langs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

// One row per thing you said: the language the listen model heard, then what the agent said back.
function Turns({ messages, status, state }: AgentPanelProps<State>) {
  const lines = messages.filter((m) => m.msg.type === 'ConversationText')
  const users = lines.filter((m) => m.msg.role === 'user')
  if (!users.length) return status === 'idle' ? null : <p className="hint">Each thing you say shows up here with the language the agent heard.</p>
  return (
    <div className="ml-turns">
      <span className="ml-turns__label">Language per turn</span>
      <ol>
        {users.map((u, i) => {
          const until = users[i + 1]?.ms ?? Infinity
          const reply = lines.find((m) => m.msg.role === 'assistant' && m.ms >= u.ms && m.ms < until)
          const heard = langs(u.msg.languages)
          const hinted = langs(u.msg.languages_hinted)
          return (
            <li key={i}>
              <span className="ml-turns__lang">{heard.length ? heard.join(', ') : 'n/a'}</span>
              <span className="ml-turns__line">{String(u.msg.content)}</span>
              <span className="ml-turns__facts">
                {heard.length
                  ? `languages: ${heard.map((l) => NAMES[l] ?? l).join(', ')}${hinted.length ? ` (hinted ${hinted.join(', ')})` : ''}`
                  : 'no languages field (Nova-3 does not send one)'}
              </span>
              {reply && (
                <span className="ml-turns__reply">
                  {String(reply.msg.content)} <em>({state.voice})</em>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Talk to it in Spanish.',
    lede: 'Ask in English, then ask again in Spanish. Flux multilingual tells you which language it heard on every turn, the prompt tells the LLM to answer in that language, and a voice that speaks both says it back.',
    ctaTitle: 'Answer every caller in their language.',
    ctaBody: (
      <>
        Listen with <code>flux-general-multi</code> and <code>language_hints</code>, prompt the LLM to match the caller, and pick
        a voice that speaks the language. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/multilingual-voice-agent' },
  initialState: { voice: 'aura-2-javier-es' },
  variants: VOICES.map((v) => ({ voice: v.id })),
  listenModels: [
    { id: 'flux-general-multi', label: 'Flux multilingual' },
    { id: 'nova-3', label: 'Nova-3 multi' },
  ],
  listen: (_s, model) => (model.startsWith('flux-') ? { version: 'v2', language_hints: HINTS } : { version: 'v1', language: 'multi' }),
  // No agent.language: flux-general-multi refuses it (INVALID_SETTINGS).
  agent: ({ voice }) => ({
    think: { provider: { type: 'open_ai', model: 'gpt-4o-mini' }, prompt: PROMPT },
    speak: speakOf(voice),
    greeting: 'Hola, Acme Pizza. What can I get you?',
  }),
  highlight: ['language_hints', 'language', 'prompt', 'speak'],
  events: ['EndOfTurn'],
  flushOnUserSpeech: () => true,
  runLabel: ({ voice }) => voice,
  phrases: () => ['What time do you open on Saturday?', 'Then the same question in Spanish:', '¿A qué hora abren el sábado?'],

  Controls({ state, setState, busy }) {
    return (
      <div className="ml-voice">
        <span className="ml-voice__label">Agent voice</span>
        <div className="segmented" role="radiogroup" aria-label="Agent voice">
          {VOICES.map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={state.voice === v.id}
              className={state.voice === v.id ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ voice: v.id })}
            >
              {v.label} · {v.note}
            </button>
          ))}
        </div>
        <p className="hint">
          Flux voices speak one language each, named by the code at the end (<code>flux-carmen-es</code> is Spanish). Aura-2 Javier
          is one of five voices that switch between English and Spanish.
        </p>
      </div>
    )
  },
  Panel: Turns,
})
