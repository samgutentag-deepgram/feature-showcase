// Defer function calls until end of turn. On a Flux listen model the agent asks the LLM for a reply
// before the turn is confirmed, and by default a function call the LLM makes in that window goes out
// at once. defer_until_eot: true on a function in agent.think.functions holds it until EndOfTurn.
// Checked live 2026-11-16 on the Agent API (flux-general-en v2, gpt-4o-mini, flux-wes-en), streaming
// a macOS `say` clip at real time: "Cancel order A1234. (0.7 s) Um, no wait, I meant order B5678."
//   defer off, answered at once (like this page): FunctionCallRequest cancel_order {"order_id":"A1234"}
//     about 0.6 s into the pause, while the turn was still open; the answer went back; then
//     UserStartedSpeaking, and no FunctionCallCancelled (2 of 2). The wrong order was cancelled. The
//     B5678 call also came about 0.2 to 0.3 s before EndOfTurn.
//   defer off, answer held 1.5 s: FunctionCallCancelled {"functions":[{"id","name":"cancel_order"}]}
//     arrived with the next UserStartedSpeaking, about 0.7 to 0.9 s after the request (3 of 3, also
//     with a get_order_status function). History then logs that call with response {"status":"CANCELLED"}.
//   defer on: the LLM still made the A1234 call (ttt_tool_latency LatencyReport), but no
//     FunctionCallRequest reached the client. One request came, for B5678, in the same millisecond
//     as EndOfTurn (4 of 4).
// With a 1.4 s pause Flux ends the turn after "A1234": then the call goes out even with defer on,
// and talking again cancels it (barge-in). On nova-3 the agent split the line into turns and made no
// early call, so this page offers Flux only.
// The server also echoes each FunctionCallResponse back to the client.
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentMessage } from '../../shared/agent/feature'
import './styles.css'

interface State {
  defer: boolean
}

export const CANCEL_ORDER = {
  name: 'cancel_order',
  description: 'Cancel an order. Call this as soon as the caller asks to cancel an order and names its number.',
  parameters: {
    type: 'object',
    properties: { order_id: { type: 'string', description: 'The order number in capitals with no spaces, like B5678' } },
    required: ['order_id'],
  },
}

export const cancelOrderFn = (defer: boolean) => (defer ? { ...CANCEL_ORDER, defer_until_eot: true } : CANCEL_ORDER)

// Demo data: every order cancels. Real code would call your order system here, and could not take it back.
export function cancelOrder(args: Json): Json {
  const id = String(args.order_id ?? '').replace(/\s/g, '').toUpperCase() || 'unknown'
  return { order_id: id, status: 'cancelled', note: 'demo data' }
}

export interface Call {
  id: string
  order: string
  // ms since Start.
  at: number
  // The call reached the page before the EndOfTurn of its turn: sent while you were still talking.
  early: boolean
  // ms since Start when FunctionCallCancelled named this call, if it did.
  cancelledAt?: number
}

// Every cancel_order call the page received and answered in this run, in order.
export function callsOf(messages: AgentMessage[]): Call[] {
  const calls: Call[] = []
  let open: Call[] = []
  for (const { ms, msg } of messages) {
    if (msg.type === 'FunctionCallRequest') {
      for (const f of (msg.functions as Json[] | undefined) ?? []) {
        let order = '?'
        try {
          order = String((JSON.parse(String(f.arguments)) as Json).order_id ?? '?').toUpperCase()
        } catch {
          // Leave it as '?'.
        }
        // Until an EndOfTurn shows up, assume early; EndOfTurn in the same tick clears it below.
        const c: Call = { id: String(f.id), order, at: ms, early: true }
        calls.push(c)
        open.push(c)
      }
    }
    if (msg.type === 'EndOfTurn') {
      for (const c of open) if (ms - c.at < 20) c.early = false
      open = []
    }
    if (msg.type === 'FunctionCallCancelled') {
      for (const f of (msg.functions as Json[] | undefined) ?? []) {
        const c = calls.find((x) => x.id === String(f.id))
        if (c) c.cancelledAt = ms
      }
    }
  }
  return calls
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const runName = (defer: boolean) => (defer ? 'defer_until_eot: true' : 'defer_until_eot not set')

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Cancel the right order.',
    lede: 'On Flux, the voice agent starts on its reply before you finish talking, and a function call it makes in that window goes out at once. Say "Cancel order A1234", a short beat, then "Um, no wait, I meant order B5678." Without defer_until_eot, the page gets a cancel_order call for A1234 while you are still talking, and runs it. With it, the call waits for the end of your turn and only B5678 is cancelled.',
    ctaTitle: 'Hold the calls you cannot take back.',
    ctaBody: (
      <>
        Add <code>"defer_until_eot": true</code> to a function in <code>agent.think.functions</code> and the agent holds that call
        until your turn is confirmed. Calls without it still go out early and save time. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-function-call-cancelled' },
  initialState: { defer: false },
  variants: [{ defer: false }, { defer: true }],
  listenModels: [{ id: 'flux-general-en', label: 'Flux' }],
  listen: () => ({ version: 'v2' }),
  agent: ({ defer }) => ({
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are an order support agent for Acme. If the caller corrects an order number, use only the corrected one. Keep answers to one short sentence.',
      functions: [cancelOrderFn(defer)],
    },
    speak: { provider: { type: 'deepgram', model: 'flux-wes-en' } },
    greeting: 'Acme orders, how can I help?',
  }),
  highlight: ['defer_until_eot'],
  events: ['FunctionCallCancelled', 'EndOfTurn'],
  flushOnUserSpeech: () => true,
  functionExample: { name: CANCEL_ORDER.name, args: { order_id: 'B5678' } },
  onFunctionCall: (name, args) => (name === CANCEL_ORDER.name ? cancelOrder(args) : { error: `no function named ${name}` }),
  runLabel: ({ defer }) => runName(defer),
  phrases: () => ['Cancel order A1234. Um, no wait, I meant order B5678.'],

  Controls({ state, setState, busy }) {
    return (
      <div className="deot-controls">
        <label className="check">
          <input type="checkbox" checked={state.defer} disabled={busy} onChange={(e) => setState({ defer: e.target.checked })} />
          Hold <code>cancel_order</code> until the end of my turn (<code>defer_until_eot</code>)
        </label>
        <p className="hint">
          Pause for a short beat after "A1234", under a second. A longer pause ends your turn there, and then the call goes out
          either way. Flux listen model only: on Nova-3 the agent made no early call.
        </p>
      </div>
    )
  },

  Panel({ state, status, messages }) {
    const calls = callsOf(messages)
    const cancelledMsgs = messages.filter((m) => m.msg.type === 'FunctionCallCancelled').length
    const started = status !== 'idle' || messages.length > 0
    return (
      <section className="panel deot" aria-label="Orders cancelled" aria-live="polite">
        <div className="deot__head">
          <span className="deot__title">Orders this page cancelled</span>
          <span className="deot__count">
            {runName(state.defer)} · {calls.length} cancel_order {calls.length === 1 ? 'call' : 'calls'} · {cancelledMsgs} FunctionCallCancelled
          </span>
        </div>
        {calls.length > 0 ? (
          <ol className="deot__rows">
            {calls.map((c) => (
              <li key={c.id} className={c.early ? 'deot__row deot__row--early' : 'deot__row'}>
                <span className="deot__ms">{seconds(c.at)}</span>
                <span className="deot__order">{c.order}</span>
                <span>
                  {c.early ? <b>sent while you were still talking</b> : 'sent with EndOfTurn'}
                  {c.cancelledAt !== undefined && <> · FunctionCallCancelled at {seconds(c.cancelledAt)}, after this page had already run it</>}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="note">
            {!started
              ? 'Press Start, wait for the greeting, and say the line. Each cancel_order call the page gets lands here; this page runs it the moment it arrives.'
              : 'No cancel_order call yet.'}
          </p>
        )}
        <p className="hint">
          The page answers each call the instant it arrives, the way a fast function would. In our runs that meant no
          FunctionCallCancelled ever came for the early A1234 call: it had already finished. The server sent one only when the
          answer was still pending as you started talking again.
        </p>
      </section>
    )
  },
})
