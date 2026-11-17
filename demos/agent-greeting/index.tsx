// agent.greeting: the agent speaks first. Checked live 2026-11-16 on the Agent API with no user
// audio at all, Flux and Nova-3 listening:
//   Welcome, SettingsApplied, then the first agent audio frame and, in the same millisecond,
//   ConversationText role assistant with the greeting word for word (60 to 150 ms after
//   SettingsApplied), then History, then AgentAudioDone 1.3 to 1.9 s later. Leave greeting out and
//   nothing follows SettingsApplied: the agent stays silent until the caller talks.
// Verified live 2026-11-16: ONLY=agent-greeting pnpm verify:live passed; all four Settings (three greetings and no greeting) came back SettingsApplied on Flux and Nova-3, and a Flux call with flux-wes-en returned Welcome, SettingsApplied, audio, ConversationText assistant "Hey there! What can I do for you?", History, AgentAudioDone.
import type { AgentPanelProps } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

interface State {
  on: boolean
  text: string
}

export const PRESETS = [
  { label: 'Front desk', text: 'Hi, thanks for calling Bloom Dental. This is Ava. How can I help you today?' },
  { label: 'Short', text: 'Hey there! What can I do for you?' },
  { label: 'Disclosure', text: 'Hi, you are speaking with an AI assistant, and this call may be recorded. How can I help?' },
]

const MAX = 200
const greetingOf = ({ on, text }: State) => (on ? text.trim().slice(0, MAX) : '')
const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`

// The first moments of the call, in order: what came back before the caller said anything.
function FirstMoments({ state, status, messages, audioStarts }: AgentPanelProps<State>) {
  if (status === 'idle' && messages.length === 0) {
    return (
      <div className="greet-panel">
        <span className="wire__label">First moments of the call</span>
        <p className="note">Press Start and say nothing. This lists what the agent sends before you talk, in order.</p>
      </div>
    )
  }
  const userAt = messages.find((m) => m.msg.type === 'UserStartedSpeaking' || (m.msg.type === 'ConversationText' && m.msg.role === 'user'))?.ms ?? Infinity
  const applied = messages.find((m) => m.msg.type === 'SettingsApplied')
  const first = messages.find((m) => m.msg.type === 'ConversationText' && m.msg.role === 'assistant')
  const rows: { ms: number; type: string; detail?: string; marked?: boolean }[] = []
  for (const m of messages) {
    if (m.ms > userAt) break
    const type = String(m.msg.type)
    if (type === 'Welcome' || type === 'SettingsApplied') rows.push({ ms: m.ms, type })
    else if (m === first) rows.push({ ms: m.ms, type: 'ConversationText', detail: `role assistant: ${String(m.msg.content)}`, marked: true })
    else if (type === 'AgentAudioDone') rows.push({ ms: m.ms, type })
  }
  if (audioStarts[0] !== undefined && audioStarts[0] <= userAt) rows.push({ ms: audioStarts[0], type: 'agent audio starts' })
  if (userAt !== Infinity) rows.push({ ms: userAt, type: 'you start talking' })
  rows.sort((a, b) => a.ms - b.ms)

  let verdict = ''
  if (first && applied && first.ms <= userAt) {
    verdict = `The agent spoke first: its greeting came back ${secs(first.ms - applied.ms)} after SettingsApplied, before you said anything.`
  } else if (applied && !greetingOf(state)) {
    verdict = 'No greeting was sent, so after SettingsApplied the agent waits for you to talk.'
  } else if (applied) {
    verdict = 'Waiting for the greeting.'
  }
  return (
    <div className="greet-panel">
      <span className="wire__label">First moments of the call</span>
      <ol className="agent-events" aria-label="First moments">
        {rows.map((r, i) => (
          <li key={i} className={r.marked ? 'is-marked' : ''}>
            <span className="agent-events__ms">{secs(r.ms)}</span>
            <span className="agent-events__type">{r.type}</span>
            {r.detail && <span className="agent-events__detail">{r.detail}</span>}
          </li>
        ))}
      </ol>
      {verdict && <p className="note">{verdict}</p>}
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Let the agent say hello first.',
    lede: 'Set agent.greeting and the agent opens the call with that line before the caller says a word. Pick or type a greeting, press Start, and stay quiet: the greeting comes back as the first ConversationText, right after SettingsApplied. Turn it off and the agent waits for you.',
    ctaTitle: 'Open every call on your terms.',
    ctaBody: (
      <>
        Put the line in <code>agent.greeting</code> in your <code>Settings</code> message. The agent speaks it as soon as
        the settings apply and sends it back as <code>ConversationText</code> with role <code>assistant</code>. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/configure-voice-agent' },
  initialState: { on: true, text: PRESETS[0].text },
  variants: [...PRESETS.map((p) => ({ on: true, text: p.text })), { on: false, text: PRESETS[0].text }],
  agent: (state) => {
    const greeting = greetingOf(state)
    return {
      language: 'en',
      think: {
        provider: { type: 'open_ai', model: 'gpt-4o-mini' },
        prompt: 'You are a friendly front desk assistant at Bloom Dental. Answer in one or two short sentences.',
      },
      speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
      ...(greeting ? { greeting } : {}),
    }
  },
  highlight: ['greeting'],
  events: ['ConversationText'],
  flushOnUserSpeech: () => true,
  runLabel: (state) => {
    const g = greetingOf(state)
    return g ? `greeting: "${g.length > 40 ? `${g.slice(0, 40)}...` : g}"` : 'no greeting'
  },
  phrases: (state) =>
    greetingOf(state)
      ? ['(Press Start and say nothing. The agent talks first.)', 'Then ask: What time do you open on Saturday?']
      : ['(Press Start and wait a few seconds. With no greeting, the agent says nothing.)', 'Then say: Hello? Is anyone there?'],
  Panel: FirstMoments,

  Controls({ state, setState, busy }) {
    const empty = state.on && !state.text.trim()
    return (
      <div className="field greet-field">
        <label className="check">
          <input type="checkbox" checked={state.on} disabled={busy} onChange={(e) => setState({ ...state, on: e.target.checked })} />
          Send a greeting
        </label>
        <div className="segmented" role="radiogroup" aria-label="Greeting">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              role="radio"
              aria-checked={state.text === p.text}
              className={state.text === p.text ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy || !state.on}
              onClick={() => setState({ ...state, text: p.text })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          className="greet-input"
          type="text"
          aria-label="Greeting the agent speaks first"
          maxLength={MAX}
          value={state.text}
          disabled={busy || !state.on}
          onChange={(e) => setState({ ...state, text: e.target.value })}
        />
        {empty && <p className="note">The greeting is empty, so none is sent and the agent waits for you.</p>}
      </div>
    )
  },
})
