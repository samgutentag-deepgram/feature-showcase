// Starter for a Deepgram LLM demo on /v1/think (`bash scripts/new.sh <id> think`). Rewrite it for
// your feature, then replace this comment with what you verified live and when.
// Early Access: the key's project must be enrolled. Text in, one POST, the reply streamed back.
import { THINK_MODELS, defineLlmFeature, type Json } from '../../shared/llm/feature'

interface State {
  model: string
}

const ORDERS: Record<string, Json> = { A1234: { status: 'shipped', eta: 'Friday' } }

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'think',
  copy: {
    headline: 'Where is my order?',
    lede: 'Ask about an order. The model calls a tool on this page, reads the answer, and replies, streamed token by token.',
    ctaTitle: 'Call /v1/think with tools and stream: true.',
    ctaBody: (
      <>
        Deepgram LLMs take a Chat Completions body at <code>agent.deepgram.com/v1/think</code>. Early Access, free while
        it lasts.
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
      { role: 'system', content: 'You help customers check on their orders. Keep replies to one or two sentences.' },
      { role: 'user', content: text },
    ],
    temperature: 0,
    stream: true,
    stream_options: { include_usage: true },
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_order_status',
          description: 'Look up the shipping status of an order. Call this when the customer gives an order number.',
          parameters: {
            type: 'object',
            properties: { order_id: { type: 'string', description: 'The order number, such as A1234.' } },
            required: ['order_id'],
          },
        },
      },
    ],
  }),
  onToolCall: (name, args) => (name === 'get_order_status' ? ORDERS[String(args.order_id)] ?? { status: 'not found' } : { error: 'unknown tool' }),
  toolExample: { name: 'get_order_status', args: { order_id: 'A1234' } },
  highlight: ['tools', 'stream', 'stream_options'],
  runLabel: ({ model }) => model,
  texts: () => ['Where is order A1234?', 'Can you check order B5678 for me?'],
  Controls({ state, setState, busy }) {
    return (
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
    )
  },
})
