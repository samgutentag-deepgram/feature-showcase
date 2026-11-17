// Temperature on /v1/think (Deepgram LLMs, Early Access). Each run sends the same body twice at
// once, so the two replies show whether this temperature repeats itself. compare keeps the last two
// runs side by side: temperature 0 next to temperature 1.
// Checked 2026-11-16 against agent.deepgram.com/v1/think on think-fast and phonellm-mini-alpha-2-fp8:
// the body takes only model, messages, temperature, reasoning_effort, tools, stream, stream_options,
// mip_opt_out. max_tokens, max_completion_tokens, top_p, stop, seed, n and frequency_penalty are each
// a 400 "Invalid think request: unknown field" on both models. temperature outside 0 to 2 is a 400.
// reasoning_effort is left to think-model-compare. "Invent a name for a coffee shop run by robots":
// phoneLLM mini at 0 gave "RoboBrew Café" 9 times in 9; at 1 it gave three different names. Think-Fast
// at 0 gave "The Iron Bean" 6 times in 7 (once "BrewBot"); at 1, three different names in 3.
// Verified live 2026-11-16: ONLY=think-generation-controls pnpm verify:live passed, 8 streamed /v1/think requests (2 models x temperature 0 and 1, each sent twice) all 200 with a reply, and every prompt.md request worked with a granted token. In the page, Think-Fast at 0 gave "The Caffeinated Circuit" on both tries; at 1 it gave "The Circuit Brew" and "The Silicon Sip".
import { LaneView } from '../../shared/llm/Results'
import { THINK_MODELS, defineLlmFeature, type ThinkBody } from '../../shared/llm/feature'
import './styles.css'

interface State {
  model: string
  temperature: number
}

const TEMPERATURES = [
  { value: 0, label: '0', detail: 'most likely word every time' },
  { value: 1, label: '1', detail: 'sampled, more variety' },
]
const TRIES = 2
const SYSTEM = 'Answer in one short line.'

const modelLabel = (id: string) => THINK_MODELS.find((m) => m.id === id)?.label ?? id

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'think',
  copy: {
    headline: 'Same question twice. Same answer?',
    lede: 'Pick a temperature and ask. The page sends the identical request twice at once. At 0 the two replies match; at 1 they drift apart. Run both and they sit side by side.',
    ctaTitle: 'Set temperature on /v1/think.',
    ctaBody: (
      <>
        Deepgram LLMs take a Chat Completions body at <code>agent.deepgram.com/v1/think</code>, with <code>temperature</code> from 0 to 2.
        Early Access: the project must be enrolled, and usage is free while it lasts.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/llm/request-response-format' },
  // /v1/think takes text. A spoken question would need a second request to transcribe it first.
  inputs: [{ id: 'text', label: 'Type', source: 'text' }],
  initialState: { model: 'think-fast', temperature: 0 },
  variants: THINK_MODELS.flatMap((m) => TEMPERATURES.map((t) => ({ model: m.id, temperature: t.value }))),
  compare: true,
  think: ({ model, temperature }, text) =>
    Array.from({ length: TRIES }, (): ThinkBody => ({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
      temperature,
      stream: true,
      stream_options: { include_usage: true },
    })),
  highlight: ['temperature'],
  runLabel: ({ model, temperature }) => `${modelLabel(model)}, temperature ${temperature}`,
  texts: () => ['Invent a name for a coffee shop run by robots. Reply with the name only.', 'Write a six-word story about a lost umbrella.'],
  Controls({ state, setState, busy }) {
    return (
      <div className="controls">
        <div className="segmented" role="radiogroup" aria-label="Model">
          {THINK_MODELS.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={state.model === m.id}
              className={state.model === m.id ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ ...state, model: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="field">
          <span className="hint">temperature</span>
          <div className="segmented" role="radiogroup" aria-label="Temperature">
            {TEMPERATURES.map((t) => (
              <button
                key={t.value}
                role="radio"
                aria-checked={state.temperature === t.value}
                className={state.temperature === t.value ? 'segmented__opt is-on' : 'segmented__opt'}
                disabled={busy}
                onClick={() => setState({ ...state, temperature: t.value })}
              >
                {t.label}, {t.detail}
              </button>
            ))}
          </div>
        </div>
        <p className="note">
          Early Access. <code>temperature</code> and <code>reasoning_effort</code> are the only generation controls /v1/think takes:{' '}
          <code>max_tokens</code>, <code>top_p</code>, <code>stop</code> and <code>seed</code> are each a 400. Think-Fast at 0 is close
          to repeatable, not exact: about one run in seven still differs.
        </p>
      </div>
    )
  },
  Result({ run }) {
    if (!run) return <p className="llm-said llm-said--muted">Two replies to the same request show up here.</p>
    const done = run.lanes.every((l) => l.status === 'done')
    const replies = run.lanes.map((l) => (l.reply ?? '').trim())
    const same = replies.every((r) => r === replies[0])
    return (
      <div className="llm-run">
        <p className="llm-said llm-said--muted">{run.text}</p>
        <div className="llm-lanes">
          {run.lanes.map((l, i) => (
            <LaneView lane={{ ...l, title: `Try ${i + 1}` }} key={i} />
          ))}
        </div>
        {done && (
          <p className={same ? 'gen-verdict gen-verdict--same' : 'gen-verdict'}>
            {same ? 'Same reply both times.' : 'Different replies to the same request.'}
          </p>
        )}
      </div>
    )
  },
})
