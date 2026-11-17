// Tool calling on /v1/think: the request declares two tools, the model asks for one (or both), this
// page answers with fake data, and the model replies from it. Each round is shown as sent.
// Early Access: the key's project must be enrolled.
// Verified live 2026-11-16: verify:live passed on think-fast and phonellm-mini-alpha-2-fp8; both call get_store_hours({"city":"Austin","day":"Saturday"}) with finish_reason tool_calls, then reply from the tool result (Think-Fast spells times out: "nine in the morning to eight at night"). On the two-tool question Think-Fast returns both calls in one response; phoneLLM mini asks one per request (3 requests). "Hi, what can you help me with?" calls no tool on either.
import { THINK_MODELS, defineLlmFeature, type ChatMessage, type Json, type LlmRun, type ThinkTool } from '../../shared/llm/feature'
import './styles.css'

interface State {
  model: string
}

const SYSTEM =
  'You are a support agent for a store chain. Use the tools to answer questions about store hours and orders. Keep replies to one or two sentences.'

const TOOLS: ThinkTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_store_hours',
      description: 'Get the opening hours of a store location for a given day. Call this when the customer asks when a store is open.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'The city of the store, such as Austin.' },
          day: { type: 'string', description: 'The day of the week, such as Saturday.' },
        },
        required: ['city', 'day'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_order_status',
      description: 'Look up the shipping status of an order. Call this when the customer gives an order number.',
      parameters: {
        type: 'object',
        properties: { order_id: { type: 'string', description: 'The order number, such as A1234.' } },
        required: ['order_id'],
      },
    },
  },
]

// Fake data, made up on this page. Any city, day, or order number gets an answer.
const str = (v: unknown) => (typeof v === 'string' && v ? v : 'unknown')
const hours = (args: Json): Json =>
  /^sun/i.test(str(args.day))
    ? { city: str(args.city), day: str(args.day), open: '11:00 AM', close: '5:00 PM' }
    : { city: str(args.city), day: str(args.day), open: '9:00 AM', close: '8:00 PM' }
const order = (args: Json): Json => {
  const id = str(args.order_id).toUpperCase()
  return id.startsWith('B')
    ? { order_id: id, status: 'processing', ships: 'tomorrow' }
    : { order_id: id, status: 'shipped', carrier: 'UPS', eta: 'Thursday' }
}

const parse = (s: string | undefined): Json => {
  try {
    return JSON.parse(s ?? '') as Json
  } catch {
    return {}
  }
}

// One request per round: what was added to messages since the last one, and what came back.
function Rounds({ run }: { run?: LlmRun<State> }) {
  if (!run) {
    return (
      <p className="llm-said llm-said--muted">
        Each round shows up here: the message sent, the tool call the model makes, the fake result this page sends back, and the
        reply.
      </p>
    )
  }
  const lane = run.lanes[0]
  return (
    <div className="llm-run">
      <p className="llm-said llm-said--muted">{run.text}</p>
      <ol className="tt-rounds">
        {lane.exchanges.map((ex, i) => {
          const messages = (body: string | undefined) => (parse(body).messages as ChatMessage[] | undefined) ?? []
          // Request 1 shows the user message (the system prompt is on the Request card); later
          // requests show what was appended: the assistant's tool_calls and the tool results.
          const added = messages(ex.request.body).slice(i === 0 ? 1 : messages(lane.exchanges[i - 1].request.body).length)
          const choice = ((ex.json?.choices as Json[] | undefined) ?? [])[0] ?? {}
          const msg = (choice.message as ChatMessage | undefined) ?? { role: 'assistant', content: null }
          const calls = msg.tool_calls ?? []
          return (
            <li className="tt-round" key={i}>
              <h3 className="llm-section__title">
                Request {i + 1} · {ex.ms} ms
              </h3>
              <span className="tt-label">{i === 0 ? 'Sent' : 'Sent back, after the earlier messages'}</span>
              <pre className="tt-json">{added.map((m) => JSON.stringify(m)).join('\n')}</pre>
              <span className="tt-label">Came back, finish_reason {String(choice.finish_reason)}</span>
              {calls.length > 0 ? (
                <pre className="tt-json">{JSON.stringify({ content: msg.content, tool_calls: calls }, null, 2)}</pre>
              ) : (
                <p className="llm-said">{msg.content?.trim() || '(no text)'}</p>
              )}
            </li>
          )
        })}
      </ol>
      {lane.status === 'running' && <p className="llm-said llm-said--muted">Waiting for the model…</p>}
      {lane.error && <p className="error">{lane.error}</p>}
      {lane.status === 'done' && !lane.calls?.length && (
        <p className="llm-said llm-said--muted">No tool call this time: the model answered from the system prompt alone.</p>
      )}
    </div>
  )
}

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'think',
  copy: {
    headline: 'Let the model call your functions',
    lede: 'Ask about store hours or an order. The model asks this page to run a tool, the page answers with fake data, and the model replies from it. Every round is shown as sent.',
    ctaTitle: 'Pass tools to /v1/think and answer its tool calls.',
    ctaBody: (
      <>
        Declare functions with JSON Schema in <code>tools</code>, run the call the model asks for, and send the result back
        as a <code>tool</code> message. Deepgram LLMs are in Early Access, free while it lasts.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/llm/request-response-format' },
  // /v1/think takes text. A spoken question would need a second request to transcribe it first.
  inputs: [{ id: 'text', label: 'Type', source: 'text' }],
  initialState: { model: 'think-fast' },
  variants: THINK_MODELS.map((m) => ({ model: m.id })),
  think: ({ model }, text) => ({
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: text },
    ],
    temperature: 0,
    tools: TOOLS,
  }),
  onToolCall: (name, args) =>
    name === 'get_store_hours' ? hours(args) : name === 'check_order_status' ? order(args) : { error: `no tool named ${name}` },
  toolExample: { name: 'get_store_hours', args: { city: 'Austin', day: 'Saturday' } },
  highlight: ['tools'],
  runLabel: ({ model }) => model,
  texts: () => [
    'Is the Austin store open on Saturday?',
    'Where is order A1234?',
    'Has order B5678 shipped, and is the Denver store open on Sunday?',
    'Hi, what can you help me with?',
  ],
  Controls({ state, setState, busy }) {
    return (
      <>
        <div className="segmented" role="radiogroup" aria-label="Model">
          {THINK_MODELS.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={state.model === m.id}
              className={state.model === m.id ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ model: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="note">
          Early Access. The tool results are fake data made up by this page: any city, day, or order number gets an answer.
          The last suggestion needs no tool, so the model replies straight away. Think-Fast asks for both tools at once on the two-part question; phoneLLM mini asks one at a time.
        </p>
      </>
    )
  },
  Result: ({ run }) => <Rounds run={run} />,
})
