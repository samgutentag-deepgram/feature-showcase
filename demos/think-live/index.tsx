// Think Live: a Deepgram model that runs next to the reasoning LLM and handles the floor.
// Verified live 2026-11-11 on the Agent API with a 30-second-style key session, gpt-4o-mini thinking:
//   Silence after the greeting, Think Live on: ConversationText presence_check "Are you still on
//   the line?" about 9 s in, then "Are you still there?". Both listen models. Off: nothing.
//   A 12 s caller turn (Aura-2 audio), sensitivity 0.9, Flux listening: ConversationText
//   backchannel "sure" 1.7 s into the turn, while the caller was still talking. Nova-3 listening:
//   no backchannel in the same test, presence checks only.
import { defineAgentFeature } from '../../shared/agent/feature'

interface State {
  on: boolean
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'It says mhmm.',
    lede: 'Think Live adds a Deepgram model next to your LLM that handles the floor: a quick "mhmm" while you talk, and a check-in when you go quiet. Read the long line slowly, then say nothing. Turn it off and hear the dead air.',
    ctaTitle: 'Give your agent manners.',
    ctaBody: (
      <>
        Add <code>agent.think_live</code> to your Settings message. Backchannels, presence checks and filler
        arrive as <code>ConversationText</code> with a <code>conversational_behavior</code>. New accounts start with
        $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-think-live' },
  initialState: { on: true },
  variants: [{ on: true }, { on: false }],
  agent: ({ on }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a delivery support agent for Acme. Collect the order number and address, then confirm them back in one short sentence.',
    },
    ...(on
      ? {
          think_live: {
            provider: {
              type: 'deepgram',
              version: 'v1',
              agent_backchannel_sensitivity: 1,
              presence_check_max_count: 1,
              presence_check_interval_ms: 8000,
            },
          },
        }
      : {}),
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, this is Acme delivery support. What is your order number and delivery address?',
  }),
  highlight: ['think_live'],
  events: ['ConversationText backchannel', 'ConversationText presence_check', 'FrustrationDetected'],
  flushOnUserSpeech: () => true,
  runLabel: ({ on }) => (on ? 'Think Live on' : 'Think Live off'),
  phrases: () => [
    '(Read slowly, with a pause at each comma:)',
    'My order number is four four one seven, the address is twelve Harbor Street, apartment three, Portland, Oregon.',
    '(Then say nothing for ten seconds.)',
  ],

  Controls({ state, setState, busy }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.on} disabled={busy} onChange={(e) => setState({ on: e.target.checked })} />
          Think Live: backchannels and presence checks
        </label>
        <p className="note">Backchannels showed up with Flux as the listen model. Presence checks work with both.</p>
      </>
    )
  },
})
