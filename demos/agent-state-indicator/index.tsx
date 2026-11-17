// Agent state indicator: a live listening / user speaking / thinking / agent speaking light, driven
// only by what the Voice Agent API actually sends. Checked live 2026-11-16 with one short exchange
// per listen model (greeting, then a 2.3 s spoken question), every server message timed:
//   Flux:   Welcome, SettingsApplied, audio, ConversationText (assistant), History, AgentAudioDone,
//           UserStartedSpeaking, ConversationText (user), History, EndOfTurn (same ms), audio 0.6 s
//           later with ConversationText (assistant), AgentAudioDone.
//   Nova-3: the same order without EndOfTurn.
// AgentThinking and AgentStartedSpeaking never arrived on either model, though the outputs page and
// the API reference list them. EndOfTurn arrives on Flux but is not documented. So thinking starts at
// EndOfTurn or the user's ConversationText, whichever comes first, and speaking is the page's own
// first audio chunk (audioStarts) until local playback runs out.
// Verified live 2026-11-16: verify:live sent the Settings message with Flux and Nova-3 listen, both came back SettingsApplied; docs links resolved.
import type { AgentMessage } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

type State = Record<string, never>

type Light = 'idle' | 'listening' | 'user' | 'thinking' | 'agent'

const LIGHTS: { id: Exclude<Light, 'idle'>; label: string; from: string }[] = [
  { id: 'listening', label: 'Listening', from: 'SettingsApplied, or after AgentAudioDone once playback runs out' },
  { id: 'user', label: 'User speaking', from: 'UserStartedSpeaking' },
  { id: 'thinking', label: 'Thinking', from: 'EndOfTurn (Flux) or ConversationText role user' },
  { id: 'agent', label: 'Agent speaking', from: 'first audio chunk of a reply, until playback ends' },
]

// The documented messages a state light would want, and whether they showed up this run.
const DOCUMENTED = ['UserStartedSpeaking', 'AgentThinking', 'AgentStartedSpeaking', 'AgentAudioDone', 'EndOfTurn']

interface Mark {
  ms: number
  to: Light
  why: string
}

// Every moment the light changes, from the server messages and the reply audio starts, in time order.
export function marks(messages: AgentMessage[], audioStarts: number[]): Mark[] {
  const out: Mark[] = []
  for (const { ms, msg } of messages) {
    const type = String(msg.type)
    if (type === 'SettingsApplied') out.push({ ms, to: 'listening', why: 'SettingsApplied' })
    else if (type === 'UserStartedSpeaking') out.push({ ms, to: 'user', why: 'UserStartedSpeaking' })
    else if (type === 'EndOfTurn') out.push({ ms, to: 'thinking', why: 'EndOfTurn' })
    else if (type === 'ConversationText' && msg.role === 'user') out.push({ ms, to: 'thinking', why: 'ConversationText (user)' })
  }
  for (const ms of audioStarts) out.push({ ms, to: 'agent', why: 'first audio chunk' })
  out.sort((a, b) => a.ms - b.ms)
  // Two messages that mean the same thing (EndOfTurn and the user's text land together) are one change.
  return out.filter((m, i) => i === 0 || m.to !== out[i - 1].to)
}

// Speaking holds while reply audio is still arriving (no AgentAudioDone since it started) or still
// playing on the page. AgentAudioDone alone is too early: the page can hold seconds of queued audio.
export function lightOf(status: string, list: Mark[], messages: AgentMessage[], playing: boolean): Light {
  if (status !== 'live') return 'idle'
  const last = list.at(-1)
  if (!last) return 'listening'
  if (last.to !== 'agent' || playing) return last.to
  const sent = messages.some(({ ms, msg }) => msg.type === 'AgentAudioDone' && ms >= last.ms)
  return sent ? 'listening' : 'agent'
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Show what the agent is doing.',
    lede: 'Ask the agent a question and watch the light move from listening to you speaking, to thinking, to the agent speaking. Every change comes from a message Deepgram sent or from the first audio of a reply, and the log shows which.',
    ctaTitle: 'Build the status light from what arrives.',
    ctaBody: (
      <>
        Turn <code>UserStartedSpeaking</code>, <code>EndOfTurn</code>, the user's <code>ConversationText</code>, and your own
        audio playback into a state your UI can show. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-outputs' },
  initialState: {},
  variants: [{}],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly librarian. Answer in one or two short sentences.',
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, how can I help?',
  }),
  highlight: ['listen'],
  events: ['UserStartedSpeaking', 'EndOfTurn', 'AgentAudioDone'],
  flushOnUserSpeech: () => true,
  runLabel: () => 'state light',
  phrases: () => ['What time does the library open on Saturday?', '(While it answers, talk over it:) Actually, what about Sunday?'],

  Controls() {
    return (
      <p className="note">
        No settings: the light reads the agent's own messages. Flux sends <code>EndOfTurn</code> when you finish, so
        thinking starts a little earlier than on Nova-3.
      </p>
    )
  },

  Panel({ status, messages, playing, audioStarts }) {
    const list = marks(messages, audioStarts)
    const light = lightOf(status, list, messages, playing)
    const seen = new Set(messages.map((m) => String(m.msg.type)))
    const ran = status === 'live' || messages.length > 0
    return (
      <div className="asi">
        <div className="asi__lights" role="status" aria-live="polite" aria-label={`Agent state: ${LIGHTS.find((l) => l.id === light)?.label ?? 'not connected'}`}>
          {LIGHTS.map((l) => (
            <div key={l.id} className={`asi__light asi__light--${l.id}${light === l.id ? ' is-on' : ''}`}>
              <span className="asi__dot" aria-hidden="true" />
              <span className="asi__name">{l.label}</span>
              <span className="asi__from">{l.from}</span>
            </div>
          ))}
        </div>
        {ran && (
          <>
            <ol className="asi__log" aria-label="State changes">
              {list.map((m, i) => (
                <li key={i}>
                  <span className="asi__ms">{secs(m.ms)}</span> {LIGHTS.find((l) => l.id === m.to)?.label} <code>{m.why}</code>
                </li>
              ))}
            </ol>
            <p className="note asi__seen">
              This run:{' '}
              {DOCUMENTED.map((t, i) => (
                <span key={t}>
                  {i > 0 && ', '}
                  <code>{t}</code> {seen.has(t) ? 'arrived' : 'never arrived'}
                </span>
              ))}
              .
            </p>
          </>
        )}
      </div>
    )
  },
})
