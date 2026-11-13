// InjectAgentMessage: your app puts words in the agent's mouth mid-call. Verified live 2026-11-11 on
// the Agent API, both listen models, a storyteller prompt so the agent is mid-reply:
//   default while the agent is mid-reply: Warning INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH, not
//     spoken. (The docs name this InjectionRefused; the server sent a Warning.)
//   default during the greeting: spoken after the greeting, so the greeting does not count as a reply.
//   default or queue while the caller is talking: Warning INJECT_AGENT_MESSAGE_DURING_USER_SPEECH.
//   queue while the agent is talking: spoken after it finishes.
//   interrupt while the agent is talking: spoken at once; the server stops the old reply, and the
//     page drops the audio it had queued so the cut is audible.
import type { AgentAction } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'

type State = Record<string, never>

const LINE = 'Quick update: a support agent is free now.'
const inject = (behavior: string, label: string): AgentAction => ({
  label,
  message: { type: 'InjectAgentMessage', behavior, message: LINE },
  // queue can come back as a Warning (the caller was talking) instead of being spoken.
  ack: behavior === 'interrupt' ? ['ConversationText'] : ['ConversationText', 'Warning'],
  flush: behavior === 'interrupt',
  primary: behavior === 'interrupt',
})

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Cut in on your own agent.',
    lede: 'Ask the agent for a story. While it is telling it, press Cut in: the agent drops the story and says your line at once. Say it next waits for the story to end. The timeline shows what the server did with each one.',
    ctaTitle: 'Say it from your app.',
    ctaBody: (
      <>
        Send <code>InjectAgentMessage</code> with a <code>behavior</code> when your app knows something the
        caller should hear. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-inject-agent-message' },
  initialState: {},
  variants: [{}],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are the Acme hold-line host. When the caller asks for a story, tell a calm story of five or six sentences. Otherwise answer in one short sentence.',
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, this is the Acme hold line. Want a story while you wait?',
  }),
  highlight: [],
  events: ['InjectAgentMessage', 'Warning'],
  flushOnUserSpeech: () => true,
  // interrupt first: it is what a mid-story button should do. default is left out because mid-reply
  // the server refuses it with a Warning, which reads as a dead button.
  actions: () => [inject('interrupt', 'Cut in now'), inject('queue', 'Say it next')],
  runLabel: () => 'inject mid-reply',
  phrases: () => ['Yes, tell me a story about a lighthouse.', '(While it is talking, press Cut in now.)'],

  Controls() {
    return (
      <p className="note">
        Cut in now sends <code>{LINE}</code> with <code>behavior: "interrupt"</code>. Say it next sends it with{' '}
        <code>"queue"</code>. They work once the agent is connected.
      </p>
    )
  },
})
