// Agent errors and warnings: five cases a visitor can set off on purpose, and what each one does to
// the session. Probed live 2026-11-16, one short session per case, Flux listening, silence streaming:
//   Unknown think model (open_ai gpt-0-does-not-exist): Error INVALID_SETTINGS "Invalid agent.think
//     settings - model not available" right after Welcome; the server closed the socket (1005).
//   Malformed Settings (agent.greeting: 42): Error UNPARSABLE_CLIENT_MESSAGE "Error parsing client
//     message. Check the agent.greeting field against the API spec."; socket closed (1005).
//   Think-Fast (deepgram think-fast): Warning VOICE_PROMPT_ADDED before SettingsApplied; still open 7 s on.
//   Dead first think provider ([open_ai gpt-4.1-nano, open_ai gpt-4o-mini]) then InjectUserMessage:
//     three Warning THINK_REQUEST_FAILED ("Code: 404 Not Found", the model is deprecated upstream),
//     then gpt-4o-mini replied "The capital of France is Paris."; still open. No endpoint, no key.
//   InjectAgentMessage behavior default while the agent tells a story (think [gpt-4o-mini, anthropic
//     claude-haiku-4-5]): Warning
//     INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH "Ignored InjectAgentMessage because the agent is already
//     in the middle of a reply."; the story carried on and the socket stayed open.
// Left out: mid-call Errors. An unknown message type or a non-JSON text frame mid-call gave Error
// UNPARSABLE_CLIENT_MESSAGE, and a second Settings gave SETTINGS_ALREADY_APPLIED, each closing the
// socket at once, but pnpm verify:live has no way to expect an Error from a mid-call message yet.
// Docs mismatch: VOICE_PROMPT_ADDED is not in the docs' Warning table.
// Verified live 2026-11-16: ONLY=agent-errors-warnings pnpm verify:live passed. With Flux and Nova-3
//   listening, the unknown think model came back Error INVALID_SETTINGS, greeting 42 came back Error
//   UNPARSABLE_CLIENT_MESSAGE, think-fast came back SettingsApplied with Warning VOICE_PROMPT_ADDED, the
//   fallback and inject Settings applied, and each mid-call message was answered (Ask a question with a
//   Warning, Ask for a story and Inject while it talks with ConversationText or a Warning); the
//   prompt.md Settings worked with a granted token.
import { useEffect, useRef, useState } from 'react'
import { defineAgentFeature, type AgentAction, type AgentMessage } from '../../shared/agent/feature'
import './styles.css'

type CaseId = 'think-model' | 'bad-field' | 'think-fast' | 'fallback' | 'inject'

interface State {
  c: CaseId
}

interface Case {
  id: CaseId
  title: string
  code: string
  kind: 'Error' | 'Warning'
  // What is wrong, in one line, shown under the picker.
  what: string
  // A mid-call trigger the Panel fires; without one, the Settings message itself is the trigger.
  run?: string
}

const CASES: Case[] = [
  { id: 'think-model', title: 'Unknown think model', code: 'INVALID_SETTINGS', kind: 'Error', what: 'agent.think.provider.model is "gpt-0-does-not-exist". The message parses, but the value is not one Deepgram offers.' },
  { id: 'bad-field', title: 'Malformed Settings', code: 'UNPARSABLE_CLIENT_MESSAGE', kind: 'Error', what: 'agent.greeting is the number 42 instead of a string, so the message does not match the schema.' },
  { id: 'think-fast', title: 'Think-Fast prompt note', code: 'VOICE_PROMPT_ADDED', kind: 'Warning', what: 'agent.think uses deepgram think-fast, which puts its own voice-style instructions ahead of your prompt and says so.' },
  { id: 'fallback', title: 'Dead think provider', code: 'THINK_REQUEST_FAILED', kind: 'Warning', what: 'agent.think is a list: gpt-4.1-nano first (its upstream answers 404), gpt-4o-mini second. Each failed try is a Warning, then the fallback answers.', run: 'Ask a question' },
  { id: 'inject', title: 'Inject over the agent', code: 'INJECT_AGENT_MESSAGE_DURING_AGENT_SPEECH', kind: 'Warning', what: 'Asks for a story, then sends InjectAgentMessage with behavior "default" while the agent is telling it. The server ignores the line.', run: 'Ask for a story, then inject' },
]

const caseOf = (id: CaseId) => CASES.find((c) => c.id === id) ?? CASES[0]

const PROMPT = 'Answer in one short sentence. When asked for a story, tell a calm story of six sentences.'
const gpt = (model: string) => ({ provider: { type: 'open_ai', model }, prompt: PROMPT })
const QUESTION = 'What is the capital of France?'
const STORY = 'Tell me a story about a lighthouse.'
const LINE = 'Quick update: a support agent is free now.'

const ACTIONS: Partial<Record<CaseId, AgentAction[]>> = {
  // Any think failure comes back as a Warning; a working first provider would answer instead.
  fallback: [{ label: 'Ask a question', message: { type: 'InjectUserMessage', content: QUESTION }, ack: ['Warning', 'ConversationText'], hidden: true }],
  inject: [
    { label: 'Ask for a story', message: { type: 'InjectUserMessage', content: STORY }, ack: ['ConversationText'], hidden: true },
    // Idle, the line is spoken (ConversationText); mid-reply, it is refused with a Warning.
    { label: 'Inject while it talks', message: { type: 'InjectAgentMessage', behavior: 'default', message: LINE }, ack: ['Warning', 'ConversationText'], hidden: true },
  ],
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const oneLine = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()
const short = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// The Errors and Warnings of a run, each with the first agent line that followed it.
export function findings(messages: AgentMessage[]) {
  return messages
    .map((m, i) => ({ ...m, i }))
    .filter(({ msg }) => msg.type === 'Error' || msg.type === 'Warning')
    .map(({ ms, msg, i }) => ({
      ms,
      type: String(msg.type),
      code: String(msg.code ?? ''),
      description: oneLine(msg.description ?? msg.message),
      next: messages.slice(i + 1).find(({ msg: n }) => n.type === 'ConversationText' && n.role === 'assistant'),
    }))
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Break the agent on purpose.',
    lede: 'Pick a case and press Start talking. The first two send a bad Settings message: the agent answers with an Error and closes the socket. The other three get a Warning and the call carries on. The panel shows each code, its description, and whether the socket stayed open.',
    ctaTitle: 'Branch on the code.',
    ctaBody: (
      <>
        Treat every <code>Error</code> as the end of the session and reconnect. Log a <code>Warning</code> and keep going.
        Give <code>think</code> a fallback so one failed provider costs a Warning, not the turn. New accounts start
        with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-errors-warnings' },
  initialState: { c: 'think-model' },
  variants: CASES.map((c) => ({ c: c.id })),
  agent: ({ c }) => {
    const speak = { provider: { type: 'deepgram', model: 'flux-wes-en' } }
    if (c === 'think-model') return { think: { provider: { type: 'open_ai', model: 'gpt-0-does-not-exist' }, prompt: PROMPT }, speak }
    if (c === 'bad-field') return { think: gpt('gpt-4o-mini'), speak, greeting: 42 }
    if (c === 'think-fast') return { think: { provider: { type: 'deepgram', model: 'think-fast' }, prompt: PROMPT }, speak }
    if (c === 'fallback') return { think: [gpt('gpt-4.1-nano'), gpt('gpt-4o-mini')], speak }
    // The pattern to copy: a working provider first and one on other infrastructure behind it.
    return { think: [gpt('gpt-4o-mini'), { provider: { type: 'anthropic', model: 'claude-haiku-4-5' }, prompt: PROMPT }], speak }
  },
  expects: ({ c }) => {
    if (c === 'think-model') return { error: 'INVALID_SETTINGS' }
    if (c === 'bad-field') return { error: 'UNPARSABLE_CLIENT_MESSAGE' }
    if (c === 'think-fast') return { warning: 'VOICE_PROMPT_ADDED' }
    // fallback and inject are set off mid-call; the Settings themselves apply cleanly.
    return {}
  },
  actions: ({ c }) => ACTIONS[c] ?? [],
  highlight: ['think', 'greeting'],
  events: ['Error', 'Warning'],
  flushOnUserSpeech: () => true,
  runLabel: ({ c }) => caseOf(c).title,
  phrases: ({ c }) => (caseOf(c).run ? [`(No need to talk. Once connected, press ${caseOf(c).run}.)`] : ['(No need to talk. The Settings message is the trigger.)']),

  Controls({ state, setState, busy }) {
    const cur = caseOf(state.c)
    return (
      <div className="aew-pick">
        <div className="segmented" role="radiogroup" aria-label="Case">
          {CASES.map((c) => (
            <button key={c.id} role="radio" aria-checked={state.c === c.id} className={state.c === c.id ? 'segmented__opt is-on' : 'segmented__opt'} disabled={busy} onClick={() => setState({ c: c.id })}>
              {c.title}
            </button>
          ))}
        </div>
        <p className="note">
          <span className={`aew-badge aew-badge--${cur.kind.toLowerCase()}`}>{cur.kind}</span> <code>{cur.code}</code>. {cur.what}
        </p>
      </div>
    )
  },

  Panel({ state, status, messages, audioStarts, fire }) {
    const cur = caseOf(state.c)
    const live = status === 'live'
    // The inject case: ask for a story, and once its audio starts, send the line over it.
    const [armed, setArmed] = useState<number | null>(null)
    const waiting = useRef<number | undefined>(undefined)
    useEffect(() => {
      if (armed === null || audioStarts.length <= armed) return
      setArmed(null)
      waiting.current = window.setTimeout(() => fire('Inject while it talks'), 600)
    }, [armed, audioStarts.length])
    useEffect(() => {
      if (!live) setArmed(null)
    }, [live])
    useEffect(() => () => window.clearTimeout(waiting.current), [])

    const trigger = () => {
      if (cur.id === 'fallback') fire('Ask a question')
      if (cur.id === 'inject') {
        setArmed(audioStarts.length)
        fire('Ask for a story')
      }
    }
    const list = findings(messages)
    const ran = messages.length > 0
    const hadError = list.some((f) => f.type === 'Error')
    const socket = status !== 'idle' ? (live ? 'Open' : 'Opening') : !ran ? '' : hadError ? 'Closed by the server after the Error' : 'Stayed open until the run stopped'
    return (
      <div className="aew" aria-live="polite">
        <div className="aew__head">
          <span className="aew__title">Errors and Warnings this run</span>
          {cur.run && (
            <button className="btn btn--primary" disabled={!live || armed !== null} onClick={trigger}>
              {armed !== null ? 'Waiting for the story…' : cur.run}
            </button>
          )}
        </div>
        {!ran ? (
          <p className="note aew__empty">
            {cur.run ? `Press Start talking, then ${cur.run} once it is connected.` : 'Press Start talking. The Settings message is the trigger.'} Expect{' '}
            {cur.kind === 'Error' ? 'an' : 'a'} {cur.kind} <code>{cur.code}</code>.
          </p>
        ) : (
          <>
            {list.length === 0 ? (
              <p className="note aew__empty">None yet.</p>
            ) : (
              <ol className="aew__list">
                {list.map((f, i) => (
                  <li key={i} className={`aew__item aew__item--${f.type.toLowerCase()}`}>
                    <span className="aew__ms">{secs(f.ms)}</span>
                    <span className={`aew-badge aew-badge--${f.type.toLowerCase()}`}>{f.type}</span>
                    <code className="aew__code">{f.code}</code>
                    <span className="aew__desc">{short(f.description)}</span>
                    {f.type === 'Warning' && f.next && i === list.length - 1 && (
                      <span className="aew__next">
                        Then, at {secs(f.next.ms)}, the agent said: "{short(oneLine(f.next.msg.content), 140)}"
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className={`aew__socket${hadError && status === 'idle' ? ' is-closed' : ''}`}>
              Socket: <strong>{socket}</strong>
            </p>
          </>
        )}
      </div>
    )
  },
})
