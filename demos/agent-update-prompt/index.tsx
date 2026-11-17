// UpdatePrompt: change the agent's instructions mid-call, without reconnecting. Checked live
// 2026-11-16 on the Agent API (gpt-4o-mini, Flux listen; the ack also on Nova-3), with typed turns
// sent as InjectUserMessage:
//   {"type":"UpdatePrompt","prompt":"From now on, talk like a pirate in every answer."} came back
//   {"type":"PromptUpdated"} in about 0.03 s, and the next answer was "Me name be Juniper!".
//   The Settings prompt stays: a code word set only in think.prompt was still answered after an
//   update, with no earlier turn that mentioned it. So UpdatePrompt adds to the Settings prompt.
//   But a second UpdatePrompt replaces the first one's text, not stacks on it: after "favorite
//   fruit is MANGO" then "favorite color is TEAL", the agent knew TEAL and said the fruit was
//   unknown (twice; sent in reverse order, the reverse). Pirate then Spanish answered in plain Spanish,
//   and five-words-or-fewer after Spanish answered in English. An empty prompt is acked
//   PromptUpdated and changes nothing: the last addition stays.
//   The docs say UpdatePrompt "will add to – not replace – the current prompt", which is true of
//   the Settings prompt only.
// Verified live 2026-11-16: pnpm verify:live applied the Settings on Flux and Nova-3, each of the three UpdatePrompt actions came back PromptUpdated on both, and the docs link resolved.
import { useEffect, useState } from 'react'
import type { AgentAction, AgentMessage } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

type State = Record<string, never>

export const BASE_PROMPT =
  'You are Juniper, a friendly guide on a Deepgram demo page. If someone asks your name, say Juniper. Answer in one or two short sentences.'

export const STYLES = [
  { label: 'Talk like a pirate', prompt: 'From now on, talk like a pirate in every answer.' },
  { label: 'Answer in Spanish', prompt: 'From now on, answer only in Spanish.' },
  { label: 'Be terse', prompt: 'From now on, answer in five words or fewer.' },
]

// The Panel draws these buttons itself so it knows which addition each PromptUpdated is for.
const action = (s: (typeof STYLES)[number]): AgentAction => ({
  label: s.label,
  message: { type: 'UpdatePrompt', prompt: s.prompt },
  ack: ['PromptUpdated'],
  hidden: true,
})

interface Reply {
  ms: number
  // Index into the sent list of the addition in effect, -1 for the Settings prompt alone.
  added: number
  text: string
}

// Agent lines grouped into replies, each tagged with the UpdatePrompt that was in effect: the
// Settings prompt plus the latest acked addition. A user line or a PromptUpdated ends a reply.
export function replies(messages: AgentMessage[]): Reply[] {
  const out: Reply[] = []
  let acked = 0
  let open = false
  for (const { ms, msg } of messages) {
    if (msg.type === 'PromptUpdated') {
      acked += 1
      open = false
    } else if (msg.type === 'ConversationText' && msg.role === 'user') open = false
    else if (msg.type === 'ConversationText' && msg.role === 'assistant') {
      const text = String(msg.content ?? '')
      if (open) out[out.length - 1].text += ` ${text}`
      else out.push({ ms, added: acked - 1, text })
      open = true
    }
  }
  return out
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Rewrite its instructions mid-call.',
    lede: 'The agent starts as Juniper, a plain, friendly guide. Ask it something, press a style, and ask again: UpdatePrompt changes how it answers on the next turn, without reconnecting. The Settings prompt stays. Each new UpdatePrompt replaces the last one.',
    ctaTitle: 'Steer the agent without hanging up.',
    ctaBody: (
      <>
        Send <code>UpdatePrompt</code> with the new instruction and wait for <code>PromptUpdated</code>. It is added
        to your Settings prompt and replaces any earlier <code>UpdatePrompt</code>. New accounts start with $200 in
        free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-update-prompt' },
  initialState: {},
  variants: [{}],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: BASE_PROMPT,
    },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: 'Hi, I am Juniper. Ask me anything, then change how I talk.',
  }),
  highlight: ['prompt'],
  events: ['PromptUpdated'],
  flushOnUserSpeech: () => true,
  actions: () => STYLES.map(action),
  runLabel: () => 'prompt updates',
  phrases: () => ['What is your name, and what is a good weekend hobby?', '(Press a style below, then ask the same question again.)'],

  Controls() {
    return (
      <p className="note">
        Each style button sends <code>UpdatePrompt</code> once the agent is connected. The panel shows the prompt in
        effect and tags every reply with it.
      </p>
    )
  },

  Panel({ status, messages, fire }) {
    // Labels in the order they were sent this run. The nth PromptUpdated acks the nth one.
    const [sent, setSent] = useState<string[]>([])
    useEffect(() => {
      if (status === 'connecting') setSent([])
    }, [status])
    const acks = messages.filter((m) => m.msg.type === 'PromptUpdated')
    const active = acks.length ? STYLES.find((s) => s.label === sent[acks.length - 1]) : undefined
    const waiting = sent.length > acks.length
    const rows = replies(messages)
    const live = status === 'live'
    const send = (label: string) => {
      setSent((all) => [...all, label])
      fire(label)
    }

    return (
      <section className="panel prompt-panel" aria-label="Prompt in effect">
        <div className="prompt-panel__styles">
          {STYLES.map((s) => (
            <button
              key={s.label}
              className={`btn btn--ghost agent-action${active?.label === s.label ? ' is-ok' : ''}${waiting && sent[sent.length - 1] === s.label ? ' is-wait' : ''}`}
              disabled={!live}
              onClick={() => send(s.label)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="prompt-panel__prompt">
          <span className="prompt-panel__label">Settings prompt (stays)</span>
          <p>{BASE_PROMPT}</p>
          <span className="prompt-panel__label">Added by UpdatePrompt (the latest one only)</span>
          <p className={active ? 'prompt-panel__added' : 'prompt-panel__none'} aria-live="polite">
            {active ? active.prompt : waiting ? 'Sent, waiting for PromptUpdated…' : 'Nothing yet.'}
          </p>
          {active && acks.length > 1 && <p className="note">The earlier UpdatePrompt text is gone: each one replaces the last.</p>}
        </div>

        {rows.length > 0 && (
          <ol className="prompt-panel__replies" aria-label="Replies by prompt">
            {rows.map((r, i) => (
              <li key={i}>
                <span className={`prompt-panel__tag${r.added >= 0 ? ' is-added' : ''}`}>{r.added >= 0 ? (sent[r.added] ?? 'updated') : 'Settings only'}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    )
  },
})
