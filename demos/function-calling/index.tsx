// Function calling on the Voice Agent API: the agent asks your code for data mid-conversation.
// Verified live 2026-11-10 with synthetic user speech ("Hi, can you tell me where my order is?
// The order number is 4815."), Flux as the listen model:
//   FunctionCallRequest {"name":"get_order_status","arguments":"{\"order_id\":\"4815\"}","client_side":true}
//   the page answered with FunctionCallResponse, and the agent said order 4815 "is out for
//   delivery and is expected to arrive today by 6 PM."
// The function runs in this page and returns made-up order data.
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature } from '../../shared/agent/feature'

interface State {
  on: boolean
}

export const GET_ORDER_STATUS = {
  name: 'get_order_status',
  description: 'Look up where an order is. Call this whenever the caller asks about an order.',
  parameters: {
    type: 'object',
    properties: { order_id: { type: 'string', description: 'The order number, digits only' } },
    required: ['order_id'],
  },
}

// Demo data: every order is out for delivery. Real code would call your order system here.
export function getOrderStatus(args: Json): Json {
  const id = String(args.order_id ?? '').replace(/\D/g, '') || 'unknown'
  return { order_id: id, status: 'out for delivery', eta: 'today by 6 pm', note: 'demo data' }
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Where is my order?',
    lede: 'Ask the agent about an order. With the function on, it calls get_order_status in this page, gets an answer back, and says it out loud. Turn the function off and ask again: it has nothing to look it up with.',
    ctaTitle: 'Give your agent tools.',
    ctaBody: (
      <>
        Describe functions in <code>agent.think.functions</code>. The agent sends{' '}
        <code>FunctionCallRequest</code>, your code answers with <code>FunctionCallResponse</code>. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agents-function-calling' },
  initialState: { on: true },
  variants: [{ on: true }, { on: false }],
  agent: ({ on }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly support agent for Acme. Keep answers to one or two short sentences.',
      ...(on ? { functions: [GET_ORDER_STATUS] } : {}),
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, thanks for calling Acme support. How can I help?',
  }),
  highlight: ['functions', 'name'],
  events: ['FunctionCallRequest'],
  flushOnUserSpeech: () => true,
  functionExample: { name: GET_ORDER_STATUS.name, args: { order_id: '4815' } },
  onFunctionCall: (name, args) => (name === GET_ORDER_STATUS.name ? getOrderStatus(args) : { error: `no function named ${name}` }),
  runLabel: ({ on }) => (on ? 'with get_order_status' : 'no functions'),
  phrases: () => ['Hi, can you tell me where my order is? The order number is 4815.'],

  Controls({ state, setState, busy }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.on} disabled={busy} onChange={(e) => setState({ on: e.target.checked })} />
        Give the agent the get_order_status function
      </label>
    )
  },
})
