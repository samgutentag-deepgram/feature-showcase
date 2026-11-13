// UpdateSpeak: change the agent's voice mid-call. Verified live 2026-11-11 on the Agent API, both
// listen models: UpdateSpeak to aura-2-orion-en, aura-2-luna-en, flux-kit-en and flux-alexis-en
// each came back SpeakUpdated in about 0.1 s, and the next line was spoken in the new voice. A voice
// that does not exist also comes back SpeakUpdated, then Error FAILED_TO_SPEAK and the session ends,
// so pick from a known list.
import type { AgentAction } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'

type State = Record<string, never>

// Flux first, then Aura-2. The page starts on Alexis.
const VOICES = [
  { name: 'Kit', model: 'flux-kit-en', family: 'Flux' },
  { name: 'Cole', model: 'flux-cole-en', family: 'Flux' },
  { name: 'Haley', model: 'flux-haley-en', family: 'Flux' },
  { name: 'Thalia', model: 'aura-2-thalia-en', family: 'Aura-2' },
  { name: 'Orion', model: 'aura-2-orion-en', family: 'Aura-2' },
]

const provider = (v: { model: string; family: string }) =>
  v.family === 'Flux' ? { type: 'deepgram', version: 'v2', model: v.model } : { type: 'deepgram', model: v.model }

// The swap only changes the next thing the agent says, so once SpeakUpdated is back the page has the
// new voice introduce itself, cutting into whatever was playing.
const swap = (v: (typeof VOICES)[number]): AgentAction => ({
  label: `${v.name} (${v.family})`,
  message: { type: 'UpdateSpeak', speak: { provider: provider(v) } },
  ack: ['SpeakUpdated'],
  then: { type: 'InjectAgentMessage', behavior: 'interrupt', message: `This is ${v.name}, a ${v.family} voice. Ask me for another fact.` },
})

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Change its voice mid-call.',
    lede: 'The agent starts as Alexis, a Flux voice. Press another voice and it answers in that voice straight away, Flux or Aura-2, without reconnecting.',
    ctaTitle: 'One call, any voice.',
    ctaBody: (
      <>
        Send <code>UpdateSpeak</code> with a new <code>speak.provider</code> and wait for <code>SpeakUpdated</code>.
        New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-update-speak' },
  initialState: {},
  variants: [{}],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a cheerful guide. Answer in one or two short sentences.',
    },
    speak: { provider: provider({ model: 'flux-alexis-en', family: 'Flux' }) },
    greeting: 'Hi, I am your guide. Ask me anything, and switch my voice whenever you like.',
  }),
  highlight: ['speak'],
  events: ['SpeakUpdated'],
  flushOnUserSpeech: () => true,
  actions: () => VOICES.map(swap),
  runLabel: () => 'voice swaps',
  phrases: () => ['Tell me a fun fact about octopuses.', '(Press a voice. It introduces itself, then:) Tell me another one.'],

  Controls() {
    return (
      <p className="note">
        Each button sends <code>UpdateSpeak</code>, then, once <code>SpeakUpdated</code> is back, an interrupting{' '}
        <code>InjectAgentMessage</code> so you hear the new voice at once. They work once the agent is connected.
      </p>
    )
  },
})
