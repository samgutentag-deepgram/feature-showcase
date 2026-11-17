// Server-side functions on the Voice Agent API: give a function an `endpoint` and Deepgram's servers
// call it, so the page never answers. Contrast demos/function-calling, where the page does.
// The endpoint is this demo's own route (server.js here) at its public URL, STORE_HOURS_URL. Deepgram
// cannot reach localhost, and the API refuses it anyway, so a local run calls the deployed copy.
// Probed live 2026-11-16 (one InjectUserMessage per run, "What are your store hours on Saturday?"):
//   endpoint STORE_HOURS_URL: SettingsApplied, then FunctionCallRequest {"name":"get_store_hours",
//     "arguments":"{\"day\":\"saturday\"}","client_side":false}, then Warning FUNCTION_CALL_FAILED
//     "HTTP error code: 404 Not Found" (the route is not deployed yet), and no agent reply in 14 s.
//   https://example.com/...: SettingsApplied, client_side false, FUNCTION_CALL_FAILED 405.
//   http://localhost:...: Error INVALID_SETTINGS "Endpoints must use https or wss".
//   https://example.invalid/...: Error INVALID_SETTINGS "Failed to resolve endpoint" (the host is
//     resolved when Settings is applied, as the configure docs say).
// NOT YET VERIFIED: Deepgram calling the deployed route and the agent speaking its answer. That needs
// a deploy. The request body Deepgram sends is undocumented, so server.js reads `day` leniently.
// Verified live 2026-11-16: verify:live sent Settings in both modes (with the endpoint, and page-answered) with Flux and Nova-3 listen, all four came back SettingsApplied; prompt.md's Settings came back SettingsApplied with a granted token; the docs link resolved. A probe saw FunctionCallRequest client_side false, then FUNCTION_CALL_FAILED 404 from the not-yet-deployed route. The round trip (Deepgram calling the deployed route, the agent speaking the hours) is unverified until deploy.
import type { AgentMessage } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import { STORE_HOURS_PATH, storeHours } from './server.js'
import './styles.css'

type Where = 'server' | 'page'

interface State {
  where: Where
}

// meta.json's url without the trailing slash, plus the route. A test checks they agree.
export const STORE_HOURS_URL = `https://dg-devrel-demos.fly.dev/demos/agent-server-functions${STORE_HOURS_PATH}`

export const GET_STORE_HOURS = {
  name: 'get_store_hours',
  description: 'Look up when the store is open. Call this whenever the caller asks about opening hours.',
  parameters: {
    type: 'object',
    properties: { day: { type: 'string', description: 'Day of the week in lowercase, for example saturday' } },
    required: ['day'],
  },
}

// No headers: never put a secret in Settings a browser sends. A real endpoint that needs auth would
// get its Settings built on your server.
export const ENDPOINT = { url: STORE_HOURS_URL, method: 'post', headers: {} }

const LABEL: Record<Where, string> = { server: 'Deepgram calls the server', page: 'This page answers' }

interface Call {
  ms: number
  name: string
  args: string
  clientSide: boolean
  failed?: string
  answered?: number
}

// Each function call this run, and what became of it: a FUNCTION_CALL_FAILED warning, or the agent's
// next line.
export function callsOf(messages: AgentMessage[]): Call[] {
  const calls: Call[] = []
  for (const { ms, msg } of messages) {
    if (msg.type === 'FunctionCallRequest') {
      for (const f of (msg.functions as Array<Record<string, unknown>> | undefined) ?? [])
        calls.push({ ms, name: String(f.name), args: String(f.arguments ?? ''), clientSide: f.client_side !== false })
      continue
    }
    const open = calls.filter((c) => c.failed === undefined && c.answered === undefined)
    if (msg.type === 'Warning' && msg.code === 'FUNCTION_CALL_FAILED') {
      const c = open.find((x) => String(msg.description ?? '').includes(x.name)) ?? open[0]
      if (c) c.failed = String(msg.description ?? msg.code).replace(/ Body: [\s\S]*$/, '')
    }
    if (msg.type === 'ConversationText' && msg.role === 'assistant') for (const c of open) c.answered = ms
  }
  return calls
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Let Deepgram call your server.',
    lede: 'Ask the agent when the store is open. With an endpoint on the function, Deepgram calls this site’s server for the hours and the page sends nothing back: the request arrives marked client_side false. Switch to "This page answers" and the same function runs in the browser instead.',
    ctaTitle: 'Keep function logic on your server.',
    ctaBody: (
      <>
        Add <code>endpoint</code> (<code>url</code>, <code>method</code>, <code>headers</code>) to a function in{' '}
        <code>agent.think.functions</code> and Deepgram calls that HTTPS URL itself. New accounts start with $200 in free
        credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agents-function-calling' },
  initialState: { where: 'server' },
  variants: [{ where: 'server' }, { where: 'page' }],
  agent: ({ where }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You answer the phone for Acme Hardware. Use get_store_hours for any question about opening hours. Keep answers to one short sentence.',
      functions: [where === 'server' ? { ...GET_STORE_HOURS, endpoint: ENDPOINT } : GET_STORE_HOURS],
    },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: 'Acme Hardware, how can I help?',
  }),
  highlight: ['endpoint', 'url'],
  events: ['FunctionCallRequest'],
  flushOnUserSpeech: () => true,
  // Only reached in "This page answers": the shell skips calls marked client_side false.
  onFunctionCall: (name, args) => (name === GET_STORE_HOURS.name ? storeHours(args) : { error: `no function named ${name}` }),
  runLabel: ({ where }) => LABEL[where].toLowerCase(),
  phrases: () => ['What time are you open on Saturday?'],

  Controls({ state, setState, busy }) {
    return (
      <>
        <div className="segmented" role="radiogroup" aria-label="Where get_store_hours runs">
          {(['server', 'page'] as const).map((w) => (
            <button
              key={w}
              role="radio"
              aria-checked={state.where === w}
              className={state.where === w ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ where: w })}
            >
              {LABEL[w]}
            </button>
          ))}
        </div>
        <p className="note">
          {state.where === 'server' ? (
            <>
              Deepgram POSTs to <code>{STORE_HOURS_URL}</code>, this site's public server, even when you run the page
              locally: the API refuses <code>http</code> and <code>localhost</code> endpoints. If the call fails, the
              timeline shows Deepgram's <code>FUNCTION_CALL_FAILED</code> warning with the HTTP status it got.
            </>
          ) : (
            <>No endpoint: the request arrives marked client_side true, and the page answers with FunctionCallResponse.</>
          )}
        </p>
      </>
    )
  },

  Panel({ messages }) {
    const calls = callsOf(messages)
    if (!calls.length) return null
    return (
      <ol className="asf" aria-label="Function calls this run">
        {calls.map((c, i) => (
          <li key={i} className="asf__call">
            <div>
              <span className="asf__ms">{secs(c.ms)}</span> <code>{c.name}({c.args})</code>{' '}
              <code className={c.clientSide ? 'asf__flag' : 'asf__flag asf__flag--server'}>client_side: {String(c.clientSide)}</code>
            </div>
            <div className="asf__what">
              {c.clientSide
                ? 'The page ran it and sent FunctionCallResponse.'
                : 'Deepgram calls the endpoint itself. The page sent nothing back.'}{' '}
              {c.failed
                ? `The call failed: ${c.failed}`
                : c.answered !== undefined
                  ? `The agent answered ${secs(c.answered - c.ms)} later.`
                  : 'Waiting for the answer.'}
            </div>
          </li>
        ))}
      </ol>
    )
  },
})
