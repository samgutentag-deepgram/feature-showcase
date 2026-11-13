// Context history: start a session that already knows the caller. Verified live 2026-11-11 on the
// Agent API, gpt-4o-mini thinking, both listen models: with agent.context.messages holding a prior
// exchange (name Priya, order 4417), "What is my name and order number?" got "Your name is Priya
// and your order number is 4417." Without the history the agent has nothing to go on.
import { defineAgentFeature } from '../../shared/agent/feature'

interface State {
  history: boolean
}

export const HISTORY = [
  { type: 'History', role: 'user', content: 'Hi, this is Priya. I ordered a patio umbrella, order 4417.' },
  { type: 'History', role: 'assistant', content: 'Thanks Priya. Order 4417 shipped Monday and should arrive Thursday.' },
  { type: 'History', role: 'user', content: 'Great. Can it be left at the side gate?' },
  { type: 'History', role: 'assistant', content: 'Done, I added a note to leave it at the side gate.' },
]

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Pick up where you left off.',
    lede: 'Send the earlier conversation in the Settings message and the agent starts the call already knowing you. Ask it about "my order" with the history on, then off.',
    ctaTitle: 'Remember the caller.',
    ctaBody: (
      <>
        Put past turns in <code>agent.context.messages</code> when the session starts, and the agent answers as if it
        never hung up. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-conversation-context' },
  initialState: { history: true },
  variants: [{ history: true }, { history: false }],
  agent: ({ history }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a delivery support agent for Acme. Use anything the caller told you earlier. If you do not know their order, ask for it. Keep answers to one or two short sentences.',
    },
    ...(history ? { context: { messages: HISTORY } } : {}),
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: history
      ? 'Welcome back to Acme delivery support. How can I help?'
      : 'Hi, this is Acme delivery support. Can I get your name and order number?',
  }),
  highlight: ['context'],
  events: ['ConversationText'],
  flushOnUserSpeech: () => true,
  runLabel: ({ history }) => (history ? 'with history' : 'no history'),
  phrases: () => ["Hi, it's me again. When is my order arriving, and where will they leave it?"],

  Controls({ state, setState, busy }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.history} disabled={busy} onChange={(e) => setState({ history: e.target.checked })} />
        Send the earlier conversation in context (4 turns)
      </label>
    )
  },
})
