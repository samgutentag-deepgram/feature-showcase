// InjectUserMessage: the visitor types a turn into a live voice call, and the agent answers it out
// loud as if it had been spoken. Probed live 2026-11-16 with {"type": "InjectUserMessage", "content":
// "What time do you close today?"} after SettingsApplied, on Flux and Nova-3:
//   agent quiet:   UserStartedSpeaking, ConversationText role user (the typed text, verbatim), History,
//                  EndOfTurn {"trigger": "manual"} (Flux only), then the agent's reply about 0.6 s later.
//   agent talking: no Error and no Warning (unlike InjectAgentMessage, which warns). It works as a
//                  barge-in: UserStartedSpeaking, AgentAudioDone (the old reply stops), the typed
//                  ConversationText, EndOfTurn on Flux, then a reply to the typed question. Same on
//                  Nova-3 without EndOfTurn, and the same during the greeting.
// The docs page shows only the request; it does not say what comes back or what happens mid-reply.
// Verified live 2026-11-16: verify:live sent the Settings message with Flux and Nova-3 listen, both came back SettingsApplied; InjectUserMessage after SettingsApplied came back as ConversationText on both; docs links resolved.
import { useState } from 'react'
import type { AgentMessage } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

type State = Record<string, never>

const LABEL = 'Typed'
const QUESTION = 'What time do you close today?'
const IDEAS = [QUESTION, 'Is there a café inside?', 'Can I take photos in the galleries?']
// The messages worth showing in a typed turn. History and LatencyReport repeat or add nothing here.
const SKIP = new Set(['History', 'LatencyReport'])

interface Turn {
  text: string
  rows: { ms: number; what: string }[]
}

// For each line the visitor typed: what the server sent from the UserStartedSpeaking it caused to the
// agent's answer, timed from that UserStartedSpeaking.
export function typedTurns(messages: AgentMessage[], typed: string[]): Turn[] {
  const out: Turn[] = []
  messages.forEach(({ msg }, i) => {
    if (msg.type !== 'ConversationText' || msg.role !== 'user' || !typed.includes(String(msg.content))) return
    let from = i
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) if (messages[j].msg.type === 'UserStartedSpeaking') from = j
    let to = messages.findIndex((m, k) => k > i && m.msg.type === 'ConversationText' && m.msg.role === 'assistant')
    if (to < 0) to = messages.length - 1
    const t0 = messages[from].ms
    const rows = messages
      .slice(from, to + 1)
      .filter((m) => !SKIP.has(String(m.msg.type)))
      .map(({ ms, msg }) => {
        const type = String(msg.type)
        const what =
          type === 'ConversationText' ? `ConversationText ${String(msg.role)}: "${String(msg.content)}"` : type === 'EndOfTurn' && msg.trigger ? `EndOfTurn trigger: ${String(msg.trigger)}` : type
        return { ms: ms - t0, what }
      })
    out.push({ text: String(msg.content), rows })
  })
  return out
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Type to a voice agent mid-call.',
    lede: 'Start the call and ask the agent something out loud. Then type a question in the box: the agent answers it by voice, and the transcript shows your typed line as yours. Type while it is still talking and it stops to answer.',
    ctaTitle: 'Add a chat box to your voice agent.',
    ctaBody: (
      <>
        Send <code>InjectUserMessage</code> with the text, and the agent takes it as the caller's next turn. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-inject-user-message' },
  initialState: {},
  variants: [{}],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are the guide at a small art museum. It is open 10 AM to 6 PM. Answer in one or two short sentences. If asked for a story, tell five calm sentences.',
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, I am the museum guide. Ask me anything, out loud or in the box.',
  }),
  highlight: [],
  events: ['InjectUserMessage', 'UserStartedSpeaking', 'EndOfTurn'],
  flushOnUserSpeech: () => true,
  // No button: the Panel's text box sends it with the typed text as content. The content here is what
  // the Request card shows and what verify:live sends.
  actions: () => [{ label: LABEL, message: { type: 'InjectUserMessage', content: QUESTION }, ack: ['ConversationText'], hidden: true }],
  runLabel: () => 'typed turns',
  phrases: () => ['What is the oldest painting here?', `(Then type in the box:) ${QUESTION}`],

  Controls() {
    return (
      <p className="note">
        The box sends <code>{`{"type": "InjectUserMessage", "content": "..."}`}</code> on the same socket as your mic. It works
        once the agent is connected.
      </p>
    )
  },

  Panel({ status, messages, fire }) {
    const [text, setText] = useState('')
    const [typed, setTyped] = useState<string[]>([])
    const live = status === 'live'
    const send = (e: { preventDefault(): void }) => {
      e.preventDefault()
      const content = text.trim()
      if (!live || !content) return
      fire(LABEL, { content })
      setTyped((all) => [...all, content])
      setText('')
    }
    const turns = typedTurns(messages, typed)
    return (
      <div className="ium">
        <form className="ium__form" onSubmit={send}>
          <label className="ium__label" htmlFor="ium-text">
            Type to the agent
          </label>
          <div className="ium__row">
            <input
              id="ium-text"
              type="text"
              value={text}
              maxLength={200}
              placeholder={live ? 'Type a question and press Enter' : 'Start talking first, then type here'}
              disabled={!live}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn btn--primary" type="submit" disabled={!live || !text.trim()}>
              Send
            </button>
          </div>
          <div className="ium__ideas">
            {IDEAS.map((idea) => (
              <button key={idea} type="button" className="ium__idea" disabled={!live} onClick={() => setText(idea)}>
                {idea}
              </button>
            ))}
          </div>
        </form>
        {turns.length > 0 && (
          <div className="ium__turns" aria-live="polite">
            {turns.map((t, i) => (
              <div className="ium__turn" key={i}>
                <p className="ium__turn-head">What came back for "{t.text}"</p>
                <ol>
                  {t.rows.map((r, k) => (
                    <li key={k}>
                      <span className="ium__ms">+{(r.ms / 1000).toFixed(2)} s</span> <code>{r.what}</code>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  },
})
