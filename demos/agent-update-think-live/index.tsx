// UpdateThink_Live: change Think Live (backchannels and presence checks) in the middle of a call.
// Probed live 2026-11-16 on the Agent API, Flux listening, gpt-4o-mini thinking, silent mic audio:
//   No update, presence_check_max_count 3, interval 4000: presence checks at 7.8, 15.7 and 22.2 s.
//   Same start, UpdateThink_Live at 13.3 s with sensitivity 0 and count 0: ThinkLiveUpdated 0.1 s
//   later, then no presence check for the next 13 s. UpdateThink_Live back to count 2 at 26.3 s:
//   ThinkLiveUpdated, and a presence_check "Hello? Are you still there?" 0.6 s later.
//   Start with everything at 0: silence for 12 s; UpdateThink_Live with count 3: ThinkLiveUpdated,
//   then a presence check 5 s later. No think_live in Settings at all: UpdateThink_Live still came
//   back ThinkLiveUpdated and a presence check followed 5.5 s later (not in the docs).
//   The card's name, UpdateThinkLive, came back Error UNPARSABLE_CLIENT_MESSAGE and the session closed.
import type { Json } from '../../shared/common/feature'
import type { AgentAction } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

interface State {
  // Think Live's asides on or off when the call starts. The buttons flip them mid-call either way.
  startOn: boolean
}

// UpdateThink_Live replaces the whole think_live.provider block, so every field goes in each time.
const thinkLive = (on: boolean): Json => ({
  provider: {
    type: 'deepgram',
    version: 'v1',
    agent_backchannel_sensitivity: on ? 1 : 0,
    presence_check_max_count: on ? 3 : 0,
    presence_check_interval_ms: 4000,
  },
})

const update = (on: boolean): AgentAction => ({
  label: on ? 'Asides on' : 'Asides off',
  message: { type: 'UpdateThink_Live', think_live: thinkLive(on) },
  ack: ['ThinkLiveUpdated'],
  primary: !on,
})

const ASIDES = ['presence_check', 'backchannel']

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Hush the small talk mid-call.',
    lede: 'Think Live fills silence with check-ins and drops in a "mhmm" while you talk. Stay quiet and the agent keeps asking if you are there. Press Asides off and the silence stays silent, press Asides on and it checks in again, all without reconnecting.',
    ctaTitle: 'Tune the manners live.',
    ctaBody: (
      <>
        Send <code>UpdateThink_Live</code> with a full <code>think_live.provider</code> block and wait for{' '}
        <code>ThinkLiveUpdated</code>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-acknowledgements' },
  initialState: { startOn: true },
  variants: [{ startOn: true }, { startOn: false }],
  agent: ({ startOn }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a delivery support agent for Acme. Collect the order number and address, then confirm them back in one short sentence.',
    },
    think_live: thinkLive(startOn),
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, this is Acme delivery support. What is your order number?',
  }),
  highlight: ['think_live'],
  events: ['ThinkLiveUpdated', 'ConversationText presence_check', 'ConversationText backchannel'],
  flushOnUserSpeech: () => true,
  actions: () => [update(false), update(true)],
  runLabel: ({ startOn }) => (startOn ? 'asides on at start' : 'asides off at start'),
  phrases: ({ startOn }) => [
    startOn ? '(Say nothing. A check-in comes about every 7 seconds.)' : '(Say nothing. The agent stays quiet.)',
    startOn ? '(Press Asides off, then wait 15 seconds: no check-in.)' : '(Press Asides on: a check-in comes within a few seconds.)',
    '(Flip it back, then:) My order number is four four one seven, the address is twelve Harbor Street.',
  ],

  Controls({ state, setState, busy }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.startOn} disabled={busy} onChange={(e) => setState({ startOn: e.target.checked })} />
          Start with asides on (backchannels and presence checks)
        </label>
        <p className="note">
          Asides off sends <code>UpdateThink_Live</code> with sensitivity and check count at 0, Asides on sends them at 1 and 3.
          Both work once the agent is connected. Backchannels showed up with Flux listening; presence checks work with both.
        </p>
      </>
    )
  },

  // The run cut at each ThinkLiveUpdated, with the Think Live lines that came in each stretch.
  Panel({ messages, status }) {
    const parts: Array<{ from: number; lines: Array<{ ms: number; kind: string; text: string }> }> = [{ from: 0, lines: [] }]
    for (const { ms, msg } of messages) {
      if (msg.type === 'ThinkLiveUpdated') parts.push({ from: ms, lines: [] })
      else if (msg.type === 'ConversationText' && ASIDES.includes(String(msg.conversational_behavior)))
        parts[parts.length - 1].lines.push({ ms, kind: String(msg.conversational_behavior), text: String(msg.content) })
    }
    if (!messages.length) return status === 'idle' ? null : <p className="note utl__empty">Waiting for the agent.</p>
    return (
      <div className="utl" aria-label="Think Live lines between updates">
        {parts.map((p, i) => (
          <section key={i} className="utl__part">
            <h3 className="utl__head">
              {i === 0 ? 'From the start' : `After ThinkLiveUpdated at ${(p.from / 1000).toFixed(1)} s`}
              <span className="utl__count">
                {p.lines.length} {p.lines.length === 1 ? 'aside' : 'asides'}
              </span>
            </h3>
            {p.lines.length > 0 && (
              <ol className="utl__lines">
                {p.lines.map((l, j) => (
                  <li key={j}>
                    <span className="utl__ms">{(l.ms / 1000).toFixed(1)} s</span> <code>{l.kind}</code> {l.text}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    )
  },
})
