// History events: the agent streams a History message for every line and every function call, as
// the call happens. Checked live 2026-11-16 (Flux and Nova-3, gpt-4o-mini, synthetic speech):
//   flags.history true (and left out, the default): a History message arrives in the same
//   millisecond as each ConversationText, greeting included, with the same role, content and
//   conversational_behavior. After each FunctionCallResponse comes one History with function_calls
//   [{id, name, client_side, arguments, response}]; client_side reads false even though the
//   FunctionCallRequest said true. Turns sent in agent.context.messages are not replayed.
//   flags.history false: no History messages at all; ConversationText and function calls unchanged,
//   and agent.context still works.
//   The docs nest it as settings.flags.history, which fails UNPARSABLE_CLIENT_MESSAGE; top-level
//   flags.history is what works.
// Verified live 2026-11-16: pnpm verify:live applied both Settings (flags.history true and false) on Flux and Nova-3, the docs link resolved, and the prompt's phrase spoken to the agent came back as get_store_hours {"store":"Portland"}.
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentMessage } from '../../shared/agent/feature'
import './styles.css'

interface State {
  history: boolean
}

export const GET_STORE_HOURS = {
  name: 'get_store_hours',
  description: 'Today\'s opening hours for one Acme store. Call this whenever the caller asks when a store opens or closes.',
  parameters: {
    type: 'object',
    properties: { store: { type: 'string', enum: ['Portland', 'Seattle'], description: 'The store city' } },
    required: ['store'],
  },
}

// Demo data. Real code would call your store system here.
export function getStoreHours(args: Json): Json {
  const store = String(args.store ?? 'unknown')
  return { store, opens: '9 am', closes: store === 'Seattle' ? '8 pm' : '9 pm', note: 'demo data' }
}

// One row of the log the page builds from History messages alone.
type Row = { ms: number; kind: 'line'; role: string; content: string } | { ms: number; kind: 'call'; name: string; args: string; response: string }

export function historyRows(messages: AgentMessage[]): Row[] {
  const rows: Row[] = []
  for (const { ms, msg } of messages) {
    if (msg.type !== 'History') continue
    if (Array.isArray(msg.function_calls)) {
      for (const f of msg.function_calls as Json[]) rows.push({ ms, kind: 'call', name: String(f.name), args: String(f.arguments ?? ''), response: String(f.response ?? '') })
    } else rows.push({ ms, kind: 'line', role: String(msg.role), content: String(msg.content ?? '') })
  }
  return rows
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Keep the transcript as you go.',
    lede: 'With flags.history on, the agent sends a History message for every line said and every function it called, the moment it happens. The page builds its log from History messages alone. Turn the flag off and have the same conversation: the agent talks just the same, and the log stays empty.',
    ctaTitle: 'Log every turn without stitching events together.',
    ctaBody: (
      <>
        Set <code>flags.history</code> at the top of the Settings message and save each <code>History</code> message
        as it arrives: lines and function calls, ready to send back in <code>agent.context</code> next time. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-history' },
  initialState: { history: true },
  variants: [{ history: true }, { history: false }],
  settings: ({ history }) => ({ flags: { history } }),
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly assistant for Acme stores in Portland and Seattle. Use get_store_hours for any question about opening or closing times. Keep answers to one short sentence.',
      functions: [GET_STORE_HOURS],
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, this is Acme. How can I help?',
  }),
  highlight: ['flags', 'history'],
  events: ['History'],
  flushOnUserSpeech: () => true,
  functionExample: { name: GET_STORE_HOURS.name, args: { store: 'Portland' } },
  onFunctionCall: (name, args) => (name === GET_STORE_HOURS.name ? getStoreHours(args) : { error: `no function named ${name}` }),
  runLabel: ({ history }) => (history ? 'flags.history true' : 'flags.history false'),
  phrases: () => ['What time does the Portland store close today?'],

  Controls({ state, setState, busy }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.history} disabled={busy} onChange={(e) => setState({ history: e.target.checked })} />
        Send History messages (<code>flags.history</code>)
      </label>
    )
  },

  Panel({ state, status, messages }) {
    const rows = historyRows(messages)
    const lines = messages.filter((m) => m.msg.type === 'ConversationText').length
    const started = status !== 'idle' || messages.length > 0
    return (
      <section className="panel history-log" aria-label="History log">
        <div className="history-log__head">
          <span className="history-log__title">Log built from History messages</span>
          <span className="history-log__count">
            {rows.length} History {rows.length === 1 ? 'entry' : 'entries'} · {lines} ConversationText
          </span>
        </div>
        {rows.length > 0 ? (
          <ol className="history-log__rows">
            {rows.map((r, i) => (
              <li key={i} className={`history-log__row history-log__row--${r.kind === 'call' ? 'call' : r.role}`}>
                <span className="history-log__ms">{seconds(r.ms)}</span>
                {r.kind === 'line' ? (
                  <>
                    <span className="history-log__role">{r.role}</span>
                    <span>{r.content}</span>
                  </>
                ) : (
                  <>
                    <span className="history-log__role">function</span>
                    <span>
                      <code>{r.name}({r.args})</code> returned <code>{r.response}</code>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="note">
            {!started
              ? 'Press Start and ask about the Portland store. Each line and the get_store_hours call land here as History messages.'
              : !state.history && lines > 0
                ? 'flags.history is false, so no History messages came. The conversation above still has every line: only the History stream is off.'
                : 'Waiting for the first History message.'}
          </p>
        )}
      </section>
    )
  },
})
