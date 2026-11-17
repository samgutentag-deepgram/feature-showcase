// Think controls: the generation settings on agent.think.provider, temperature and reasoning_mode.
// Probed live 2026-11-16 on the Agent API, one fresh session per ask, the question sent with
// InjectUserMessage after the greeting:
//   open_ai gpt-4o-mini, "Name a new ice cream flavor": temperature 0 said "Lavender Honey Bliss."
//   three sessions out of three. Temperature 1.5 said "Coastal Caramel Swirl.", "Tropical Sunrise
//   Sorbet." and "Coconut Lime Swirl.". LLM first token about 0.6 s either way.
//   open_ai gpt-5-mini, the bat and ball question: reasoning_mode minimal first token 0.63 to 0.84 s,
//   low 1.2 to 1.4 s, medium 1.9 to 2.0 s, high 3.1 to 3.8 s. Every level answered five cents
//   in these runs (minimal once said ten cents in an earlier probe with a different prompt).
//   Rejected: temperature on gpt-5-mini (OpenAI 400 "Only the default (1) value is supported", three
//   THINK_REQUEST_FAILED warnings, then Error FAILED_TO_THINK). reasoning_mode on gpt-4o-mini (OpenAI
//   400 "Unrecognized request argument supplied: reasoning_effort", same pattern). temperature 3 on
//   gpt-4o-mini and 1.5 on anthropic claude-haiku-4-5 (provider range errors, same pattern).
//   max_tokens, max_completion_tokens, top_p, frequency_penalty, presence_penalty, seed and stop on
//   open_ai, and max_tokens on anthropic: Error UNPARSABLE_CLIENT_MESSAGE at Settings. A reasoning_mode
//   outside minimal, low, medium, high: UNPARSABLE_CLIENT_MESSAGE.
//   Also accepted: temperature on anthropic claude-haiku-4-5, groq openai/gpt-oss-20b and google
//   gemini-2.5-flash; reasoning_mode low on groq openai/gpt-oss-20b.
// Docs mismatch: reasoning_mode also takes "minimal" (the docs list low, medium, high).
import { useEffect, useRef, useState } from 'react'
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

export type Mode = 'temperature' | 'reasoning'
export type Effort = 'minimal' | 'low' | 'medium' | 'high'

interface State {
  mode: Mode
  temperature: number
  effort: Effort
}

export const TEMPERATURES = [0, 1, 1.5]
export const EFFORTS: Effort[] = ['minimal', 'low', 'medium', 'high']

// Each control lives on the model that accepts it: gpt-4o-mini takes temperature and rejects
// reasoning_mode, gpt-5-mini takes reasoning_mode and only the default temperature.
export const SETUP: Record<Mode, { model: string; question: string; greeting: string; button: string }> = {
  temperature: {
    model: 'gpt-4o-mini',
    question: 'Name a new ice cream flavor. Say only the name.',
    greeting: 'Hi. Ask me to name a new ice cream flavor.',
    button: 'Ask for a flavor name',
  },
  reasoning: {
    model: 'gpt-5-mini',
    question: 'A bat and a ball cost one dollar ten in total. The bat costs one dollar more than the ball. How much is the ball?',
    greeting: 'Hi. Ask me a tricky question.',
    button: 'Ask the bat and ball question',
  },
}

const PROMPT = 'You are a friendly voice assistant. Answer in one short sentence.'

export const providerOf = (s: State): Json =>
  s.mode === 'temperature'
    ? { type: 'open_ai', model: SETUP.temperature.model, temperature: s.temperature }
    : { type: 'open_ai', model: SETUP.reasoning.model, reasoning_mode: s.effort }

export const settingLabel = (s: State) => (s.mode === 'temperature' ? `temperature ${s.temperature}` : `reasoning_mode ${s.effort}`)

export interface Reply {
  text: string
  // Seconds, from LatencyReport.ttt_token_latency.
  firstToken?: number
}

// The agent's replies this run, greeting left out, each with the LLM first-token time that came
// with it. A LatencyReport arrives just before the reply's ConversationText.
export function repliesOf(messages: Array<{ msg: Json }>, greeting: string): Reply[] {
  const out: Reply[] = []
  let token: number | undefined
  for (const { msg } of messages) {
    if (msg.type === 'LatencyReport' && typeof msg.ttt_token_latency === 'number') token = msg.ttt_token_latency
    if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content !== greeting) {
      out.push({ text: String(msg.content), firstToken: token })
      token = undefined
    }
  }
  return out
}

interface Row extends Reply {
  run: number
  setting: string
}

const ms = (s?: number) => (s === undefined ? '' : `${Math.round(s * 1000)} ms`)

// Keeps every reply across runs on this page, so the same question at different settings sits in one
// table: the same name every time at temperature 0, a new one at 1.5, a longer wait at higher effort.
function ControlsPanel({ state, status, messages, fire }: AgentPanelProps<State>) {
  const [past, setPast] = useState<Row[]>([])
  const run = useRef({ n: 0, setting: settingLabel(state), greeting: SETUP[state.mode].greeting })
  const current = useRef<Row[]>([])
  useEffect(() => {
    if (status !== 'connecting') return
    // A new run: file the last one's replies and start counting again.
    setPast((p) => [...current.current, ...p].slice(0, 12))
    current.current = []
    run.current = { n: run.current.n + 1, setting: settingLabel(state), greeting: SETUP[state.mode].greeting }
  }, [status])
  const now: Row[] = run.current.n
    ? repliesOf(messages, run.current.greeting)
        .map((r) => ({ ...r, run: run.current.n, setting: run.current.setting }))
        .reverse()
    : []
  current.current = now
  const rows = [...now, ...past]
  const scale = Math.max(1, ...rows.map((r) => r.firstToken ?? 0))
  const live = status === 'live'
  const setup = SETUP[state.mode]
  return (
    <div className="tc" aria-live="polite">
      <div className="tc__head">
        <button className="btn agent-action" disabled={!live} onClick={() => fire(setup.button)}>
          {setup.button}
        </button>
        <span className="tc__hint">{live ? 'Sends the question as InjectUserMessage, or just say it.' : 'Works once the agent is connected.'}</span>
      </div>
      {rows.length === 0 ? (
        <p className="tc__empty">Each reply lands here with its setting and the LLM first-token time. Stop, change the setting, and ask again.</p>
      ) : (
        <table className="tc__table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Setting</th>
              <th>LLM first token</th>
              <th>Reply</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.run}-${i}`}>
                <td className="tc__num">{r.run}</td>
                <td className="tc__setting">{r.setting}</td>
                <td className="tc__lat">
                  <span className="tc__bar" style={{ width: `${((r.firstToken ?? 0) / scale) * 100}%` }} aria-hidden="true" />
                  <span>{ms(r.firstToken)}</span>
                </td>
                <td className="tc__text">{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Segmented({ label, options, value, busy, pick }: { label: string; options: Array<[string, string]>; value: string; busy: boolean; pick(v: string): void }) {
  return (
    <div className="field tc__field">
      <span className="tc__label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'segmented__opt is-on' : 'segmented__opt'} disabled={busy} onClick={() => pick(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Same question, new settings.',
    lede: 'Turn the knobs on the agent\'s LLM. Temperature 0 names the same ice cream flavor every call; 1.5 makes up a new one. Reasoning effort on gpt-5-mini trades a longer wait for more thinking. Ask, stop, change one setting, ask again.',
    ctaTitle: 'Tune the LLM in one Settings field.',
    ctaBody: (
      <>
        Add <code>temperature</code> or <code>reasoning_mode</code> to <code>agent.think.provider</code>. Each one only
        works on models that take it. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/configure-voice-agent' },
  initialState: { mode: 'temperature', temperature: 0, effort: 'minimal' },
  variants: [
    ...TEMPERATURES.map((temperature): State => ({ mode: 'temperature', temperature, effort: 'minimal' })),
    ...EFFORTS.map((effort): State => ({ mode: 'reasoning', temperature: 0, effort })),
  ],
  agent: (s) => ({
    think: { provider: providerOf(s), prompt: PROMPT },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: SETUP[s.mode].greeting,
  }),
  highlight: ['temperature', 'reasoning_mode'],
  events: ['Warning'],
  flushOnUserSpeech: () => true,
  actions: (s) => [{ label: SETUP[s.mode].button, message: { type: 'InjectUserMessage', content: SETUP[s.mode].question }, ack: ['ConversationText'], hidden: true }],
  runLabel: settingLabel,
  phrases: (s) => [SETUP[s.mode].question, '(Then stop, change the setting, start again and ask the same thing.)'],

  Controls({ state, setState, busy }) {
    const temp = state.mode === 'temperature'
    return (
      <>
        <Segmented
          label="Control"
          options={[
            ['temperature', 'temperature, gpt-4o-mini'],
            ['reasoning', 'reasoning_mode, gpt-5-mini'],
          ]}
          value={state.mode}
          busy={busy}
          pick={(mode) => setState({ ...state, mode: mode as Mode })}
        />
        {temp ? (
          <Segmented
            label="temperature"
            options={TEMPERATURES.map((t) => [String(t), String(t)])}
            value={String(state.temperature)}
            busy={busy}
            pick={(t) => setState({ ...state, temperature: Number(t) })}
          />
        ) : (
          <Segmented label="reasoning_mode" options={EFFORTS.map((e) => [e, e])} value={state.effort} busy={busy} pick={(e) => setState({ ...state, effort: e as Effort })} />
        )}
        <p className="note">
          {temp
            ? 'OpenAI takes 0 to 2, Anthropic 0 to 1. gpt-5-mini rejects any temperature but the default.'
            : 'OpenAI reasoning models only; gpt-4o-mini rejects it. The docs list low, medium and high, and minimal works too.'}{' '}
          max_tokens, top_p and stop are not accepted: the Settings message fails with UNPARSABLE_CLIENT_MESSAGE.
        </p>
      </>
    )
  },

  Panel: ControlsPanel,
})
