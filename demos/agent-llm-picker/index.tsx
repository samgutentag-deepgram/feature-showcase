// Agent LLM picker: choose the agent's think provider and model, agent.think.provider { type, model },
// before the call starts, and compare reply latency across runs. Switching mid-call is a different
// message (UpdateThink), for the agent-update-think card.
// Checked live 2026-11-16 with a one-off script, one session per model: Settings with that think
// provider (no endpoint, no third-party key), then InjectUserMessage "What is the capital of France?",
// then the reply, its audio and a LatencyReport total_latency. Every model in models.ts replied.
// LLM first token (ttt_token_latency) in that one pass, seconds: think-fast 0.07, phonellm-mini 0.06,
// Groq gpt-oss-20b 0.34, gemini-2.5-flash-lite 0.35, claude-haiku-4-5 and 5-5 0.38, gpt-4o-mini 0.62,
// gpt-5 1.12, gemini-3.8-flash 2.39, gemini-3.1-pro-preview 3.71. One sample each: not a benchmark.
// Failed and left out:
//   gpt-4.1-nano: SettingsApplied, then three THINK_REQUEST_FAILED ("Code: 404 Not Found", the model
//   does not exist upstream) and FAILED_TO_THINK. Same on a retry.
//   INVALID_SETTINGS "Invalid agent.think settings - model not available" for these models the docs
//   page lists: gpt-5.3-chat-latest, gpt-5.2-chat-latest, gpt-5.1-chat-latest, claude-3-5-haiku-latest,
//   claude-sonnet-4-20250514, gemini-3.1-flash-lite-preview, gemini-3-pro-preview,
//   gemini-2.0-flash-lite, nemotron-3-nano-30B-A3B.
//   aws_bedrock needs the visitor's own AWS credentials and endpoint, so it is not offered.
// Docs mismatches: Groq replied with no endpoint (docs say endpoint is required). GET
// /v1/agent/settings/think/models lists models the docs page does not (gpt-6-luna, claude-haiku-5-5,
// claude-sonnet-5-5, gemini-2.5-flash-lite, gemini-3.1-pro-preview, gemini-3.8-flash,
// nvidia/nemotron-3.5-lightning-30b-a3b, all of which replied) and leaves out the deepgram models.
// think-fast sends Warning VOICE_PROMPT_ADDED after SettingsApplied; phonellm-mini does not.
import { useEffect, useRef, useState } from 'react'
import { defineAgentFeature, type AgentMessage, type AgentPanelProps } from '../../shared/agent/feature'
import { modelName, PROVIDERS, providerOf } from './models'
import './styles.css'

interface State {
  provider: string
  model: string
}

export const QUESTION = 'In one sentence, why is the sky blue?'
const PROMPT = 'You are a friendly assistant on a phone call. Answer in one or two short sentences.'

const labelOf = ({ provider, model }: State) => `${modelName(provider, model)} (${providerOf(provider).label})`

export interface Turn {
  user: string
  reply: string
  // Seconds, from LatencyReport. Each report carries one field.
  token?: number
  tts?: number
  total?: number
}

// One turn per LatencyReport total_latency. stt_latency (Flux sends it all call long) is left out:
// the listen model is the same whichever LLM is picked.
export function turnsOf(messages: AgentMessage[]): Turn[] {
  const turns: Turn[] = []
  let open: Turn = { user: '', reply: '' }
  for (const { msg } of messages) {
    if (msg.type === 'ConversationText' && msg.role === 'user') open.user = String(msg.content)
    if (msg.type === 'ConversationText' && msg.role === 'assistant' && open.user && !open.reply) open.reply = String(msg.content)
    if (msg.type !== 'LatencyReport') continue
    if (typeof msg.ttt_token_latency === 'number') open.token = msg.ttt_token_latency
    if (typeof msg.tts_latency === 'number') open.tts = msg.tts_latency
    if (typeof msg.total_latency === 'number') {
      open.total = msg.total_latency
      turns.push(open)
      open = { user: '', reply: '' }
    }
  }
  return turns
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const ms = (s?: number) => (s === undefined ? '' : `${Math.round(s * 1000)} ms`)

interface Row {
  id: number
  label: string
  turns: Turn[]
  error?: string
}

// One row per run, kept across runs so models sit side by side. Rows live only in this page view.
function Board({ state, status, messages }: AgentPanelProps<State>) {
  const [rows, setRows] = useState<Row[]>([])
  const was = useRef(status)
  useEffect(() => {
    if (was.current === 'idle' && status !== 'idle') setRows((rs) => [...rs, { id: (rs.at(-1)?.id ?? 0) + 1, label: labelOf(state), turns: [] }].slice(-8))
    was.current = status
  }, [status])
  useEffect(() => {
    if (!messages.length) return
    const err = messages.find((m) => m.msg.type === 'Error')?.msg
    setRows((rs) => {
      const last = rs.at(-1)
      if (!last) return rs
      return [...rs.slice(0, -1), { ...last, turns: turnsOf(messages), error: err ? String(err.code) : undefined }]
    })
  }, [messages])

  const scale = Math.max(1, ...rows.flatMap((r) => r.turns.map((t) => t.total ?? 0)))
  return (
    <div className="llm" aria-live="polite">
      <div className="llm__head">
        <span className="llm__title">Reply latency by model</span>
        <span className="llm__meta">From LatencyReport, per turn: LLM first token, then total until the reply's audio starts.</span>
      </div>
      {rows.length === 0 ? (
        <p className="llm__empty">Pick a model, press Start, and ask something (or press Ask the same question). Then stop, pick another model, and ask again. Each run lands here as a row.</p>
      ) : (
        <div className="llm__scroll">
          <table className="llm__table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Turns</th>
                <th>LLM first token, median</th>
                <th>Total, median</th>
                <th className="llm__wide">Each turn</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => {
                const token = median(r.turns.flatMap((t) => (t.token === undefined ? [] : [t.token])))
                const total = median(r.turns.flatMap((t) => (t.total === undefined ? [] : [t.total])))
                const lastReply = r.turns.at(-1)?.reply
                return (
                  <tr key={r.id}>
                    <td className="llm__run">
                      <span className="llm__num">{r.id}</span>
                      <span className="llm__model">{r.label}</span>
                      {lastReply && <span className="llm__reply">"{lastReply}"</span>}
                      {r.error && <span className="llm__err">{r.error}</span>}
                    </td>
                    <td className="llm__val">{r.turns.length}</td>
                    <td className="llm__val">{ms(token)}</td>
                    <td className="llm__val">{ms(total)}</td>
                    <td className="llm__wide">
                      {r.turns.map((t, i) => (
                        <div key={i} className="llm-bar" title={`${t.user}: ${ms(t.token)} first token, ${ms(t.total)} total`}>
                          <span className="llm-bar__total" style={{ width: `${((t.total ?? 0) / scale) * 100}%` }} />
                          <span className="llm-bar__token" style={{ width: `${((t.token ?? 0) / scale) * 100}%` }} />
                        </div>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="llm__legend">
        <span className="llm__key llm__key--token" /> LLM first token (ttt_token_latency) <span className="llm__key llm__key--total" /> total_latency.
        One run is a small sample: network and provider load move these numbers between calls.
      </p>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Pick the brain behind your voice agent.',
    lede: "Choose the LLM the agent thinks with, from Deepgram's own models or managed OpenAI, Anthropic, Google, Groq and NVIDIA models, then press Start and talk. No key for those providers is needed. Run the same question on a few models and compare their reply latency side by side.",
    ctaTitle: 'Swap LLMs with one field.',
    ctaBody: (
      <>
        Set <code>agent.think.provider</code> to a <code>type</code> and <code>model</code> in <code>Settings</code>. Deepgram runs the managed
        models for you; add <code>agent.think.endpoint</code> to bring your own. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-llm-models' },
  initialState: { provider: 'deepgram', model: 'think-fast' },
  // One Settings per provider type; the model string is the only other difference. Every model in
  // models.ts was checked live on 2026-11-16 (see the top of this file).
  variants: PROVIDERS.map((p) => ({ provider: p.type, model: p.models[0].id })),
  agent: ({ provider, model }) => ({
    language: 'en',
    think: { provider: { type: provider, model }, prompt: PROMPT },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: `Hi, you are talking to ${modelName(provider, model)}. Ask me anything.`,
  }),
  // think-fast puts Deepgram's spoken-style instructions ahead of the prompt and says so.
  expects: ({ model }) => (model === 'think-fast' ? { warning: 'VOICE_PROMPT_ADDED' } : {}),
  highlight: ['think'],
  events: ['EndOfTurn', 'Warning'],
  flushOnUserSpeech: () => true,
  actions: () => [{ label: 'Ask the same question', message: { type: 'InjectUserMessage', content: QUESTION }, ack: ['ConversationText'] }],
  runLabel: labelOf,
  phrases: () => [QUESTION, '(Stop, pick another model, press Start, and ask again.)'],

  Controls({ state, setState, busy }) {
    const current = providerOf(state.provider)
    return (
      <div className="llmp">
        <div className="segmented" role="radiogroup" aria-label="LLM provider">
          {PROVIDERS.map((p) => (
            <button
              key={p.type}
              role="radio"
              aria-checked={current.type === p.type}
              className={current.type === p.type ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => current.type !== p.type && setState({ provider: p.type, model: p.models[0].id })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="llmp__label" htmlFor="llmp-model">
          Model{current.tag && <span className="llmp__tag">{current.tag}</span>}
        </label>
        <select id="llmp-model" value={state.model} disabled={busy} onChange={(e) => setState({ ...state, model: e.target.value })}>
          {current.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.id})
            </option>
          ))}
        </select>
        <p className="note">
          {current.type === 'deepgram'
            ? "Deepgram's LLMs are in Early Access for contract customers; this page has access. Think-Fast adds spoken-style instructions ahead of your prompt and sends a VOICE_PROMPT_ADDED warning."
            : 'Deepgram hosts this model for you, so the Settings message has no endpoint and no provider key.'}{' '}
          The model is set when the call starts; switching mid-call is a different message, UpdateThink. Amazon Bedrock needs your own AWS
          credentials, so it is not offered here.
        </p>
      </div>
    )
  },

  Panel: Board,
})
