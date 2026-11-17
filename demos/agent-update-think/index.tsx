// UpdateThink: swap the agent's LLM (and its prompt) mid-call, with no reconnect. Probed live
// 2026-11-16 on the Agent API, starting on open_ai gpt-4o-mini, one session, an InjectUserMessage
// question after each swap:
//   UpdateThink to anthropic claude-haiku-4-5, google gemini-2.5-flash, groq openai/gpt-oss-20b (no
//   endpoint) and open_ai gpt-4o-mini each came back ThinkUpdated in 30 to 80 ms, and the next reply
//   came from the new model. deepgram think-fast (Early Access) came back Warning VOICE_PROMPT_ADDED,
//   then ThinkUpdated. LLM first token on the next reply: think-fast 0.16 s, gpt-4o-mini about 0.6 s,
//   claude-haiku-4-5 0.62 s, gpt-oss-20b about 0.4 s, gemini-2.5-flash about 1.5 s to first audio.
//   UpdateThink replaces the whole think block: a pirate prompt, then an UpdateThink with only a
//   provider, and the next reply was plain English again. So every button here resends the prompt.
//   An unknown model (anthropic claude-3-5-haiku-latest) came back Error INVALID_SETTINGS "model not
//   available" and the session closed, so offer a known list.
// Verified live 2026-11-16: ONLY=agent-update-think pnpm verify:live passed. The Settings message
// (open_ai gpt-4o-mini, flux-wes-en) came back SettingsApplied on Flux and Nova-3, each of the five
// UpdateThink messages came back ThinkUpdated on both, and the docs link resolved.
import { useEffect, useState } from 'react'
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentAction, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

type State = Record<string, never>

const PROMPT = 'You are a helpful guide. Answer in one or two short sentences.'
const PIRATE = 'You are a pirate. Answer in one or two short sentences, in pirate speak.'
const GREETING = 'Hi, I am your guide. Ask me something, then switch my brain and ask again.'

interface Brain {
  label: string
  provider: Json
  prompt: string
}

const START: Brain = { label: 'OpenAI gpt-4o-mini', provider: { type: 'open_ai', model: 'gpt-4o-mini' }, prompt: PROMPT }

// Managed LLMs that replied on this key, none needing an endpoint. Think-Fast is Deepgram's own (Early
// Access) and adds its voice-style instructions ahead of the prompt, with a VOICE_PROMPT_ADDED warning.
export const BRAINS: Brain[] = [
  { label: 'Anthropic claude-haiku-4-5', provider: { type: 'anthropic', model: 'claude-haiku-4-5' }, prompt: PROMPT },
  { label: 'Deepgram think-fast', provider: { type: 'deepgram', model: 'think-fast' }, prompt: PROMPT },
  { label: 'Google gemini-2.5-flash', provider: { type: 'google', model: 'gemini-2.5-flash' }, prompt: PROMPT },
  { label: 'Groq gpt-oss-20b', provider: { type: 'groq', model: 'openai/gpt-oss-20b' }, prompt: PROMPT },
  { label: 'gpt-4o-mini as a pirate', provider: { type: 'open_ai', model: 'gpt-4o-mini' }, prompt: PIRATE },
]

// The Panel draws the buttons, so it knows which swap each ThinkUpdated answers.
const swap = (b: Brain): AgentAction => ({
  label: b.label,
  message: { type: 'UpdateThink', think: { provider: b.provider, prompt: b.prompt } },
  ack: ['ThinkUpdated'],
  hidden: true,
})

export interface Reply {
  text: string
  // Seconds, from LatencyReport.
  firstToken?: number
  total?: number
}

export interface Segment {
  label: string
  // Warning or Error codes that came with this swap.
  notes: string[]
  acked: boolean
  replies: Reply[]
}

// Splits the run at each ThinkUpdated: the k-th one answers the k-th swap sent. A Warning or Error that
// lands while a swap is waiting for its ack belongs to that swap (VOICE_PROMPT_ADDED comes just before
// ThinkUpdated). Each reply collects the LatencyReport fields around it; the greeting is skipped.
export function segment(messages: Array<{ msg: Json }>, sent: string[]): Segment[] {
  const segs: Segment[] = [{ label: `${START.label} (start)`, notes: [], acked: true, replies: [] }]
  let acks = 0
  let open: Reply | undefined
  const current = () => segs[acks]
  const pending = () => {
    while (segs.length <= sent.length) segs.push({ label: sent[segs.length - 1], notes: [], acked: false, replies: [] })
    return sent.length > acks ? segs[acks + 1] : undefined
  }
  const reply = () => {
    if (!open) {
      open = { text: '' }
      current().replies.push(open)
    }
    return open
  }
  for (const { msg } of messages) {
    pending()
    if (msg.type === 'ThinkUpdated') {
      acks++
      if (segs[acks]) segs[acks].acked = true
      open = undefined
    } else if (msg.type === 'Warning' || msg.type === 'Error') {
      ;(pending() ?? current()).notes.push(`${String(msg.type)} ${String(msg.code ?? '')}`.trim())
    } else if (msg.type === 'LatencyReport') {
      if (typeof msg.ttt_token_latency === 'number') reply().firstToken = msg.ttt_token_latency
      if (typeof msg.total_latency === 'number') {
        reply().total = msg.total_latency
        open = undefined
      }
    } else if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content !== GREETING) {
      if (!msg.conversational_behavior || msg.conversational_behavior === 'default') {
        const r = open ?? current().replies.at(-1)
        if (r && !r.text) r.text = String(msg.content)
        else current().replies.push({ text: String(msg.content) })
      }
    }
  }
  pending()
  return segs
}

const ms = (s?: number) => (s === undefined ? '' : `${Math.round(s * 1000)} ms`)

function SwitchPanel({ status, messages, fire }: AgentPanelProps<State>) {
  const [sent, setSent] = useState<string[]>([])
  useEffect(() => {
    if (status === 'connecting') setSent([])
  }, [status])
  const segs = segment(messages, sent)
  const waiting = sent.length > segs.filter((s, i) => i > 0 && s.acked).length
  const live = status === 'live'
  const press = (label: string) => {
    setSent((s) => [...s, label])
    fire(label)
  }
  return (
    <div className="ut" aria-live="polite">
      <div className="ut__buttons">
        <span className="ut__title">Switch the LLM to</span>
        {BRAINS.map((b) => (
          <button key={b.label} className="btn btn--ghost agent-action" disabled={!live || waiting} onClick={() => press(b.label)}>
            {b.label}
          </button>
        ))}
      </div>
      {!live && <p className="ut__empty">The buttons work once the agent is connected.</p>}
      <ol className="ut__list">
        {segs.map((s, i) => (
          <li key={i} className={s.acked ? 'ut__seg' : 'ut__seg is-waiting'}>
            <div className="ut__head">
              <span className="ut__model">{s.label}</span>
              {i > 0 && <span className="ut__ack">{s.acked ? 'ThinkUpdated' : 'waiting for ThinkUpdated'}</span>}
              {s.notes.map((n, j) => (
                <span key={j} className="ut__note">
                  {n}
                </span>
              ))}
            </div>
            {s.replies.length === 0 ? (
              <p className="ut__none">{s.acked ? 'Ask it something.' : ''}</p>
            ) : (
              <ul className="ut__replies">
                {s.replies.map((r, j) => (
                  <li key={j}>
                    <span className="ut__lat">{r.firstToken !== undefined ? `first token ${ms(r.firstToken)}` : ''}</span>
                    <span className="ut__lat">{r.total !== undefined ? `total ${ms(r.total)}` : ''}</span>
                    <span className="ut__text">{r.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Swap its brain mid-call.',
    lede: 'The agent starts on OpenAI gpt-4o-mini. Ask it something, switch to Anthropic, Google, Groq or Deepgram Think-Fast, and ask again. Same call, same voice, a different LLM answering, with its first-token time next to each reply.',
    ctaTitle: 'Change the LLM without hanging up.',
    ctaBody: (
      <>
        Send <code>UpdateThink</code> with a new <code>think</code> block and wait for <code>ThinkUpdated</code>. It
        replaces the whole block, so send the prompt with it. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-update-think' },
  initialState: {},
  variants: [{}],
  agent: () => ({
    language: 'en',
    think: { provider: START.provider, prompt: START.prompt },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: GREETING,
  }),
  highlight: ['think'],
  events: ['ThinkUpdated'],
  flushOnUserSpeech: () => true,
  actions: () => BRAINS.map(swap),
  runLabel: () => 'LLM swaps',
  phrases: () => ['What is a good name for a pet octopus?', '(Press a model below, wait for ThinkUpdated, then ask the same thing again.)'],

  Controls() {
    return (
      <p className="note">
        Each button sends <code>UpdateThink</code> with a new provider and model and the same prompt (the pirate one swaps
        the prompt instead). The panel files each reply under the LLM that wrote it.
      </p>
    )
  },

  Panel: SwitchPanel,
})
