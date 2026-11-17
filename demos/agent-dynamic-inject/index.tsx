// InjectAgentMessage with is_dynamic: true. Instead of a fixed message, Think Live words a filler line
// itself. Probed live 2026-11-16 on the Agent API, gpt-4o-mini thinking, Think Live with backchannels
// and presence checks at 0, caller turns sent as InjectUserMessage text, mostly Flux listening:
//   It worded a line ("I'm pulling it up.", "Let me check the current status of your order.") as
//   ConversationText with conversational_behavior "filler", 1 to 4 s after the ask.
//   Otherwise: Warning DYNAMIC_FILLER_UNAVAILABLE, "Ignored InjectAgentMessage because no dynamic
//   filler could be produced.", about 0.1 s after the ask, and nothing spoken.
//   How often, 16 sessions, 71 asks with the agent quiet (behavior queue):
//     the first ask of a call: 14 of 15 worded a line (the one miss was sent during the greeting);
//     asking again before the caller had said anything: 14 of 18 came back the warning;
//     after the caller's first turn: 35 of 38 worded a line (the 3 misses were each the first ask
//     right after a reply, and the next ask worked).
//   Without agent.think_live: the same code, described "is_dynamic needs agent.think_live".
//   Nova-3 listening: worded lines before and after a caller turn (one session).
//   Mid-reply (a five-sentence story): default came back Warning INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH
//   "Ignored InjectAgentMessage because the agent is already in the middle of a reply." 3 of 3.
//   queue: once spoken after the story ended, once DYNAMIC_FILLER_UNAVAILABLE. interrupt: spoken
//   0.2 s later, cutting the story ("I'll search for that.").
//   The worded lines narrate a lookup ("Let me try checking with your email address instead"), so
//   they fit a real wait in your app, not small talk.
// Verified live 2026-11-16: verify:live sent the Settings message (think_live on) with Flux and Nova-3 listen, both came back SettingsApplied; Agent words it and Fixed line were each sent 1.5 s in with both listen models and came back ConversationText or Warning (the check accepts either, so the warning rate above comes from the probes, not this run); docs link resolved.
import { useEffect, useRef } from 'react'
import type { Json } from '../../shared/common/feature'
import type { AgentAction, AgentMessage } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

interface State {
  // When DYNAMIC_FILLER_UNAVAILABLE comes back, the page sends the fixed line in its place.
  fallback: boolean
}

const LINE = 'One moment while I check that.'
const DYNAMIC = 'Agent words it'
const FIXED = 'Fixed line'
const UNAVAILABLE = 'DYNAMIC_FILLER_UNAVAILABLE'

const actions: AgentAction[] = [
  // ConversationText (the filler) or a Warning (DYNAMIC_FILLER_UNAVAILABLE) both mean it landed.
  { label: DYNAMIC, message: { type: 'InjectAgentMessage', behavior: 'queue', is_dynamic: true }, ack: ['ConversationText', 'Warning'], primary: true },
  { label: FIXED, message: { type: 'InjectAgentMessage', behavior: 'queue', message: LINE }, ack: ['ConversationText', 'Warning'] },
]

interface Row {
  ms: number
  text: string
  warn: boolean
  // Caller turns before this row: 0 means the caller had not spoken yet.
  turns: number
}

// Splits the run into what came back for each kind of ask, read from the server messages alone.
export function outcomes(messages: AgentMessage[]) {
  const dynamic: Row[] = []
  const fixed: Row[] = []
  const other: Row[] = []
  let turns = 0
  for (const { ms, msg } of messages) {
    if (msg.type === 'ConversationText' && msg.role === 'user') turns++
    else if (msg.type === 'ConversationText' && msg.conversational_behavior === 'filler') dynamic.push({ ms, text: String(msg.content), warn: false, turns })
    else if (msg.type === 'ConversationText' && msg.content === LINE) fixed.push({ ms, text: LINE, warn: false, turns })
    else if (msg.type === 'Warning' && msg.code === UNAVAILABLE) dynamic.push({ ms, text: UNAVAILABLE, warn: true, turns })
    else if (msg.type === 'Warning' && String(msg.code).startsWith('INJECT_AGENT_MESSAGE')) other.push({ ms, text: String(msg.code), warn: true, turns })
  }
  return { dynamic, fixed, other }
}

const when = (r: Row) => (r.turns === 0 ? 'before you spoke' : `after turn ${r.turns}`)

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ol className="dyn__rows">
      {rows.map((r, i) => (
        <li key={i} className={r.warn ? 'is-warn' : ''}>
          <span className="dyn__ms">{(r.ms / 1000).toFixed(1)} s</span>{' '}
          {r.warn ? <code>Warning {r.text}</code> : <>&ldquo;{r.text}&rdquo;</>} <span className="dyn__when">{when(r)}</span>
        </li>
      ))}
    </ol>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Let the agent word its own filler.',
    lede: 'Your app is busy and the line is quiet. Press Agent words it and Think Live writes a stalling line from the conversation so far. Press Fixed line to hear the line you wrote. Sometimes there is no line to write: the server sends DYNAMIC_FILLER_UNAVAILABLE and says nothing, and the panel counts how often.',
    ctaTitle: 'Cover the wait without a script.',
    ctaBody: (
      <>
        Add <code>agent.think_live</code> to Settings, then send <code>InjectAgentMessage</code> with{' '}
        <code>is_dynamic: true</code> and no <code>message</code>. Handle the warning with a fixed line. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-inject-agent-message' },
  initialState: { fallback: true },
  // fallback is page logic only: both settings send the same Settings message.
  variants: [{ fallback: true }],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are an Acme order-status agent. Answer in one short sentence.',
    },
    // Backchannels and presence checks off, so every Think Live line here is one you asked for.
    think_live: {
      provider: {
        type: 'deepgram',
        version: 'v1',
        agent_backchannel_sensitivity: 0,
        presence_check_max_count: 0,
        presence_check_interval_ms: 8000,
      },
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, this is Acme orders. What can I check for you?',
  }),
  highlight: ['think_live'],
  events: ['InjectAgentMessage', 'ConversationText filler', 'Warning'],
  flushOnUserSpeech: () => true,
  actions: () => actions,
  runLabel: ({ fallback }) => (fallback ? 'dynamic, fixed line on the warning' : 'dynamic, no fallback'),
  phrases: () => [
    '(After the greeting, press Agent words it once, then again.)',
    'Where is my order four four one seven?',
    '(When it answers, press Agent words it again, then Fixed line.)',
  ],

  Controls({ state, setState, busy }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.fallback} disabled={busy} onChange={(e) => setState({ fallback: e.target.checked })} />
          When {UNAVAILABLE} comes back, send the fixed line instead
        </label>
        <p className="note">
          Agent words it sends <code>{'{"type": "InjectAgentMessage", "behavior": "queue", "is_dynamic": true}'}</code>. Fixed line
          sends the same with <code>"message": "{LINE}"</code>. Both work once the agent is connected.
        </p>
      </>
    )
  },

  Panel({ state, status, messages, fire }) {
    const { dynamic, fixed, other } = outcomes(messages)
    const lines = dynamic.filter((r) => !r.warn).length
    const warned = dynamic.length - lines

    // The fallback: each new DYNAMIC_FILLER_UNAVAILABLE sends the fixed line once.
    const handled = useRef(0)
    useEffect(() => {
      if (!messages.length) handled.current = 0
      const seen = messages.filter((m: { msg: Json }) => m.msg.type === 'Warning' && m.msg.code === UNAVAILABLE).length
      if (seen > handled.current) {
        handled.current = seen
        if (state.fallback && status === 'live') fire(FIXED)
      }
    }, [messages, state.fallback, status, fire])

    if (status === 'idle' && !messages.length) return null
    return (
      <div className="dyn" aria-live="polite">
        <div className="dyn__cols">
          <section className="dyn__col">
            <h3 className="dyn__head">
              Worded by the agent <code>is_dynamic</code>
              <span className="dyn__count">
                {lines} {lines === 1 ? 'line' : 'lines'}, {warned} {warned === 1 ? 'warning' : 'warnings'}
              </span>
            </h3>
            {dynamic.length ? <Rows rows={dynamic} /> : <p className="note">Nothing asked yet.</p>}
          </section>
          <section className="dyn__col">
            <h3 className="dyn__head">
              Fixed line <code>message</code>
              <span className="dyn__count">
                {fixed.length} {fixed.length === 1 ? 'line' : 'lines'}
              </span>
            </h3>
            {fixed.length ? <Rows rows={fixed} /> : <p className="note">Nothing sent yet.</p>}
          </section>
        </div>
        {other.length > 0 && <Rows rows={other} />}
        <p className="dyn__advice">
          What we measured (71 asks in 16 calls): the first ask of a call worded a line 14 of 15 times. Asking again before
          the caller had said anything came back {UNAVAILABLE} 14 of 18 times. After the caller&rsquo;s first turn, 35 of
          38 asks worded a line. So ask once early, and always keep a fixed line for the warning.
        </p>
      </div>
    )
  },
})
