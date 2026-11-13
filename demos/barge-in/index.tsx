// Barge-in: talk over the agent and it stops. Verified live 2026-11-10 on the Agent API with a
// 30-second token and synthetic user speech sent 2.5 s into a long greeting:
//   UserStartedSpeaking arrived about 0.9 s after the user started talking, with AgentAudioDone.
//   By then the server had already sent about 11 s of greeting audio, far ahead of playback.
// So Deepgram detects the interruption, and the page decides what to do with the audio it is
// holding. With the switch on, it drops that queued audio; off, the agent keeps talking over you.
import { defineAgentFeature } from '../../shared/agent/feature'

interface State {
  flush: boolean
}

export const GREETING =
  'Hi, thanks for calling Acme support. Before we start, let me tell you about our new spring catalog, which has over two hundred new products across home, garden, and outdoor living, with free shipping on every order this month.'

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Interrupt it.',
    lede: 'The agent opens with a long sales pitch. Talk over it. Deepgram sends UserStartedSpeaking the moment you start, and the page drops the audio it was about to play. Turn that off and hear what happens without it.',
    ctaTitle: 'Let your callers cut in.',
    ctaBody: (
      <>
        The Voice Agent API sends <code>UserStartedSpeaking</code> as soon as the caller talks. Stop your
        playback when it arrives. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent' },
  initialState: { flush: true },
  variants: [{ flush: true }, { flush: false }],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly support agent for Acme. Keep answers to one or two short sentences.',
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: GREETING,
  }),
  highlight: ['greeting'],
  events: ['UserStartedSpeaking'],
  flushOnUserSpeech: ({ flush }) => flush,
  runLabel: ({ flush }) => (flush ? 'stops when you talk' : 'keeps talking'),
  phrases: () => ['(Wait a second or two into the greeting, then talk over it:)', 'Sorry to interrupt, I just need to check on my order.'],

  Controls({ state, setState, busy }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.flush} disabled={busy} onChange={(e) => setState({ flush: e.target.checked })} />
        Stop the agent's audio on UserStartedSpeaking
      </label>
    )
  },
})
