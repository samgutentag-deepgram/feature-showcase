// Model compare on /v1/think: one message, sent to every Deepgram LLM at once, side by side.
// Early Access: the key's project must be enrolled. Both models in the docs answered this key;
// any other name ("phonellm-mini", "think-slow") is a 400 "Model not available." (checked 2026-11-16).
// Verified live 2026-11-16: verify:live streamed both models at reasoning none and low, all four
//   replies non-empty. By hand, "move my cleaning to Thursday afternoon" (none): Think-Fast first token
//   494 ms, 109 in / 34 out; phoneLLM mini 378 ms, 108 in / 18 out. At low: Think-Fast 2501 ms with 422
//   reasoning tokens; phoneLLM mini 430 ms, reasoning text then </think> in the reply. Callback number
//   chip: Think-Fast read it back as "four one five, five five five, zero one four two".
import { THINK_MODELS, defineLlmFeature, type ThinkBody } from '../../shared/llm/feature'

type Effort = 'none' | 'low'

interface State {
  reasoning: Effort
}

const SYSTEM =
  'You answer the phone for Bright Smile Dental. Your reply is spoken aloud by a voice, so use one or two short sentences, no lists or markdown. Hours: Monday to Friday 8 AM to 5 PM, Saturday 9 AM to noon, closed Sunday. A cleaning takes 45 minutes. You cannot see the schedule: take the request and say the front desk will confirm by text.'

const EFFORTS: { id: Effort; label: string }[] = [
  { id: 'none', label: 'Reasoning off' },
  { id: 'low', label: 'Reasoning low' },
]

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'think',
  copy: {
    headline: 'Which LLM should answer the phone?',
    lede: 'Type what a caller says. The same request goes to Think-Fast and phoneLLM mini at the same time, and each reply streams into its own column with time to first token, total time, and tokens. Turn reasoning on and watch the first token slow down.',
    ctaTitle: 'Switch models by changing one field.',
    ctaBody: (
      <>
        Both models take the same Chat Completions body at <code>agent.deepgram.com/v1/think</code>; only{' '}
        <code>model</code> changes. Deepgram LLMs are in Early Access: your project must be enrolled, and usage is free
        while it lasts.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/llm/models' },
  // /v1/think takes text. A spoken question would need a second request to transcribe it first.
  inputs: [{ id: 'text', label: 'Type', source: 'text' }],
  initialState: { reasoning: 'none' },
  variants: EFFORTS.map((e) => ({ reasoning: e.id })),
  think: ({ reasoning }, text): ThinkBody[] =>
    THINK_MODELS.map((m) => ({
      model: m.id,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
      temperature: 0,
      reasoning_effort: reasoning,
      stream: true,
      stream_options: { include_usage: true },
    })),
  highlight: ['model', 'reasoning_effort'],
  runLabel: ({ reasoning }) => (reasoning === 'none' ? 'reasoning off' : `reasoning ${reasoning}`),
  texts: () => [
    'Hi, can I move my cleaning to Thursday afternoon?',
    'Are you open on Saturday?',
    "Can you take my callback number? It's 415 555 0142.",
  ],
  Controls({ state, setState, busy }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="Reasoning">
        {EFFORTS.map((e) => (
          <button
            key={e.id}
            role="radio"
            aria-checked={state.reasoning === e.id}
            className={state.reasoning === e.id ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={busy}
            onClick={() => setState({ reasoning: e.id })}
          >
            {e.label}
          </button>
        ))}
      </div>
    )
  },
})
