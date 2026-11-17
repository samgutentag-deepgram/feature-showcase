// Agent filler: Think Live covers a slow function call with a short line it words itself.
// Probed live 2026-11-16 on the Agent API, gpt-4o-mini thinking, Think Live on in both runs with
// backchannels and presence checks at 0, get_order_status answered 3 s after FunctionCallRequest:
//   Filler on (initial_agent_filler true): a ConversationText tagged conversational_behavior
//   "filler" came 0.24 to 0.50 s after FunctionCallRequest in 7 of 7 runs ("I'll look that up.",
//   "Let me find that.", "I'm pulling it up."), Flux and Nova-3 listening, typed and spoken turns.
//   Filler off: nothing from the agent for the 3 s, 4 of 4 runs; its answer came 3.7 s after the request.
//   An 8 s wait with agent_filler_max_count 1 and interval 2000 gave a second filler, "One sec.",
//   4.4 s after the first one stopped. Filler fields with no think_live: Error INVALID_SETTINGS
//   "Function 'get_order_status': agent filler needs agent.think_live".
//   The filler line does not always fit: twice it said "using your email address" when the caller
//   had given an order number.
// Verified live 2026-11-16: verify:live sent both Settings variants (filler on and off) with Flux and Nova-3 listen, all came back SettingsApplied, and the spoken order question came back as FunctionCallRequest get_order_status {"order_id":"4815"}; docs links resolved.
import { useRef } from 'react'
import type { Json } from '../../shared/common/feature'
import type { AgentMessage } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

interface State {
  filler: boolean
}

// How long the page holds the answer, to stand in for a slow order system.
export const DELAY_MS = 3000

const FILLER = { initial_agent_filler: true, agent_filler_max_count: 1, agent_filler_interval_ms: 2000 }

export const getOrderStatusFn = (filler: boolean): Json => ({
  name: 'get_order_status',
  description: 'Look up where an order is. Call this whenever the caller asks about an order.',
  parameters: {
    type: 'object',
    properties: { order_id: { type: 'string', description: 'The order number, digits only' } },
    required: ['order_id'],
  },
  ...(filler ? FILLER : {}),
})

// Demo data: every order is out for delivery. Real code would call your order system here.
export function getOrderStatus(args: Json): Json {
  const id = String(args.order_id ?? '').replace(/\D/g, '') || 'unknown'
  return { order_id: id, status: 'out for delivery', eta: 'today by 6 pm', note: 'demo data' }
}

interface Run {
  lines: Array<{ at: number; text: string; kind: string }>
  firstAudio?: number
  answered?: number
}

// The last run of each kind, kept for this page view so the two sit side by side.
const last: { on?: Run; off?: Run } = {}

// Everything after the first FunctionCallRequest, in seconds from it.
function summarize(messages: AgentMessage[], audioStarts: number[]): Run | undefined {
  const req = messages.find((m) => m.msg.type === 'FunctionCallRequest')
  if (!req) return undefined
  const s = (ms: number) => (ms - req.ms) / 1000
  const run: Run = { lines: [] }
  for (const { ms, msg } of messages) {
    if (ms < req.ms) continue
    if (msg.type === 'FunctionCallResponse' && run.answered === undefined) run.answered = s(ms)
    if (msg.type === 'ConversationText' && msg.role === 'assistant')
      run.lines.push({ at: s(ms), text: String(msg.content), kind: String(msg.conversational_behavior ?? 'default') })
  }
  const audio = audioStarts.find((ms) => ms > req.ms)
  if (audio !== undefined) run.firstAudio = s(audio)
  return run
}

function Column({ title, run }: { title: string; run?: Run }) {
  return (
    <section className="aff__col">
      <h3 className="aff__head">{title}</h3>
      {!run ? (
        <p className="aff__none">No run yet.</p>
      ) : (
        <>
          <p className="aff__gap">
            {run.firstAudio === undefined ? 'No agent audio yet' : `First agent audio ${run.firstAudio.toFixed(1)} s after the call went out`}
          </p>
          <ol className="aff__lines">
            <li>
              <span className="aff__ms">0.0 s</span> <code>FunctionCallRequest</code>
            </li>
            {[
              ...run.lines.map((l) => ({ at: l.at, node: <><code>{l.kind}</code> {l.text}</> })),
              ...(run.answered === undefined ? [] : [{ at: run.answered, node: <><code>FunctionCallResponse</code> sent by this page</> }]),
            ]
              .sort((a, b) => a.at - b.at)
              .map((x, i) => (
                <li key={i}>
                  <span className="aff__ms">{x.at.toFixed(1)} s</span> {x.node}
                </li>
              ))}
          </ol>
        </>
      )}
    </section>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'No dead air while it looks it up.',
    lede: `Ask about an order. This page holds its answer to get_order_status for ${DELAY_MS / 1000} seconds, like a slow order system. With filler on, Think Live says a short line of its own while you wait. Turn it off, ask again, and compare the two runs side by side.`,
    ctaTitle: 'Cover the slow calls.',
    ctaBody: (
      <>
        Add <code>initial_agent_filler</code>, <code>agent_filler_max_count</code> and <code>agent_filler_interval_ms</code> to a function in{' '}
        <code>agent.think.functions</code>, with <code>agent.think_live</code> on. Filler arrives as <code>ConversationText</code> with{' '}
        <code>conversational_behavior: &quot;filler&quot;</code>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-think-live' },
  initialState: { filler: true },
  variants: [{ filler: true }, { filler: false }],
  agent: ({ filler }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly support agent for Acme. Keep answers to one or two short sentences. Call get_order_status right away without announcing it.',
      functions: [getOrderStatusFn(filler)],
    },
    // Think Live is on in both runs, with backchannels and presence checks off, so the only
    // difference is the filler fields on the function.
    think_live: {
      provider: { type: 'deepgram', version: 'v1', agent_backchannel_sensitivity: 0, presence_check_max_count: 0, presence_check_interval_ms: 8000 },
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, thanks for calling Acme support. How can I help?',
  }),
  highlight: ['initial_agent_filler', 'agent_filler_max_count', 'agent_filler_interval_ms'],
  events: ['FunctionCallRequest', 'ConversationText filler'],
  flushOnUserSpeech: () => true,
  functionExample: { name: 'get_order_status', args: { order_id: '4815' } },
  onFunctionCall: (name, args) => (name === 'get_order_status' ? getOrderStatus(args) : { error: `no function named ${name}` }),
  functionDelayMs: () => DELAY_MS,
  runLabel: ({ filler }) => (filler ? 'filler on' : 'filler off'),
  phrases: () => ['Hi, can you tell me where my order is? The order number is 4815.', '(Then wait. The page answers the lookup after 3 seconds.)'],

  Controls({ state, setState, busy }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.filler} disabled={busy} onChange={(e) => setState({ filler: e.target.checked })} />
          Filler on get_order_status
        </label>
        <p className="note">
          The page answers <code>FunctionCallRequest</code> {DELAY_MS / 1000} s late on purpose. Think Live is on either way; this box only adds the
          three filler fields to the function. A second filler needs a longer wait than 3 s.
        </p>
      </>
    )
  },

  // The last filler-on and filler-off runs, timed from the function call.
  Panel({ state, messages, audioStarts }) {
    const key = useRef<'on' | 'off' | undefined>(undefined)
    if (!messages.length) key.current = undefined
    else if (!key.current) key.current = state.filler ? 'on' : 'off'
    const run = summarize(messages, audioStarts)
    if (key.current && run) last[key.current] = run
    if (!last.on && !last.off) return null
    return (
      <div className="aff" aria-label="Filler on and off, timed from the function call">
        <Column title="Filler on" run={last.on} />
        <Column title="Filler off" run={last.off} />
      </div>
    )
  },
})
